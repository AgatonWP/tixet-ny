import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import {
  Conversation,
  Message,
  fetchConversation,
  fetchMessages,
  getOrCreateConversation,
  sendMessage,
  subscribeToMessages,
} from '@/lib/messages';
import { RatingSummary, fetchRatingSummary } from '@/lib/ratings';
import { Listing, formatListingEventDate, formatTicketQuantity, markListingSold } from '@/lib/tickets';
import { useUnreadMessages } from '@/lib/unread-messages';
import { ReportModal } from '@/components/report-modal';
import { RatingModal } from '@/components/rating-modal';
import { blockUser, getBlockStatus, unblockUser } from '@/lib/blocking';
import { clearDraft, linkDraftKey, readDraft, saveDraft } from '@/lib/chat-drafts';
import { fetchSellerSwishNumber } from '@/lib/payment-details';

type Props = {
  listing: Listing | null;
  /** When opened from an inbox (e.g. as the seller), pass the known conversation id to skip creation. */
  conversationId?: string;
  onClose: () => void;
  /** Notifies the caller (e.g. the inbox list) when the seller marks the listing sold from here. */
  onListingSold?: (listing: Listing) => void;
};

export function ChatModal({ listing, conversationId, onClose, onListingSold }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { language, t } = useI18n();
  const { markConversationRead } = useUnreadMessages();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [ratingSummary, setRatingSummary] = useState<RatingSummary | null>(null);
  const [swishNumberCopied, setSwishNumberCopied] = useState(false);
  const [sellerSwishNumber, setSellerSwishNumber] = useState<string | null>(null);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [interactionBlocked, setInteractionBlocked] = useState(false);
  const [blockSubmitting, setBlockSubmitting] = useState(false);
  const [markingSold, setMarkingSold] = useState(false);
  const [ratingListing, setRatingListing] = useState<Listing | null>(null);
  const listRef = useRef<FlatList>(null);
  const screenTranslateX = useRef(new Animated.Value(0)).current;
  const draftKey = conversationId ?? listing?.id ?? null;

  useEffect(() => {
    setDraft(draftKey ? readDraft(draftKey) : '');
  }, [draftKey]);

  const handleDraftChange = useCallback(
    (value: string) => {
      setDraft(value);
      if (draftKey) saveDraft(draftKey, value);
    },
    [draftKey],
  );

  useEffect(() => {
    screenTranslateX.setValue(0);
  }, [listing?.id, screenTranslateX]);

  useEffect(() => {
    if (!listing) {
      setRatingSummary(null);
      return;
    }

    let active = true;
    fetchRatingSummary(listing.userId)
      .then((summary) => {
        if (active) setRatingSummary(summary.count > 0 ? summary : null);
      })
      .catch(() => {
        if (active) setRatingSummary(null);
      });

    return () => {
      active = false;
    };
  }, [listing]);

  useEffect(() => {
    if (!listing || !user) return;

    let active = true;
    setLoading(true);
    setLoadError(null);
    setConversation(null);
    setMessages([]);

    const load = conversationId
      ? fetchConversation(conversationId)
      : getOrCreateConversation(
          listing.id,
          user.id,
          user.user_metadata?.full_name ?? user.email?.split('@')[0],
          user.user_metadata?.avatar_url,
        );

    load
      .then(async (conv) => {
        if (!active) return;
        if (draftKey) linkDraftKey(draftKey, conv.id);
        setConversation(conv);
        const msgs = await fetchMessages(conv.id, user.id);
        if (!active) return;
        setMessages(msgs);
        markConversationRead(conv.id);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : 'Kunde inte ladda chatten.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [listing, conversationId, draftKey, user, markConversationRead]);

  useEffect(() => {
    if (!conversation || !user) {
      setSellerSwishNumber(null);
      setBlockedByMe(false);
      setInteractionBlocked(false);
      return;
    }

    let active = true;
    const otherUserId = conversation.sellerId === user.id ? conversation.buyerId : conversation.sellerId;

    Promise.all([
      getBlockStatus(otherUserId),
      conversation.sellerId === user.id
        ? Promise.resolve(null)
        : fetchSellerSwishNumber(conversation.sellerId),
    ])
      .then(([blockStatus, swishNumber]) => {
        if (!active) return;
        setBlockedByMe(blockStatus.blockedByMe);
        setInteractionBlocked(blockStatus.interactionBlocked);
        setSellerSwishNumber(swishNumber);
      })
      .catch(() => {
        if (!active) return;
        setSellerSwishNumber(null);
      });

    return () => {
      active = false;
    };
  }, [conversation, user]);

  useEffect(() => {
    if (!conversation || !user) return;

    return subscribeToMessages(conversation.id, user.id, (message) => {
      setMessages((current) => (current.some((m) => m.id === message.id) ? current : [...current, message]));
      markConversationRead(conversation.id);
    });
  }, [conversation, user, markConversationRead]);

  const scrollToBottom = useCallback(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
      setTimeout(scrollToBottom, 50);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [scrollToBottom]);

  const handleSend = useCallback(async () => {
    if (!conversation || !user || !draft.trim() || sending) return;

    const text = draft.trim();
    setSending(true);
    setSendError(null);

    try {
      const message = await sendMessage(conversation.id, user.id, text);
      setDraft('');
      if (draftKey) clearDraft(draftKey);
      setMessages((current) => (current.some((m) => m.id === message.id) ? current : [...current, message]));
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Kunde inte skicka meddelandet.');
    } finally {
      setSending(false);
    }
  }, [conversation, user, draft, draftKey, sending]);

  const handleCopySwishNumber = useCallback(async () => {
    if (!sellerSwishNumber) return;

    await Clipboard.setStringAsync(sellerSwishNumber);
    setSwishNumberCopied(true);
    setTimeout(() => setSwishNumberCopied(false), 1500);
  }, [sellerSwishNumber]);

  const handleToggleBlock = useCallback(async () => {
    if (!conversation || !user || blockSubmitting) return;

    const otherUserId = conversation.sellerId === user.id ? conversation.buyerId : conversation.sellerId;
    setBlockSubmitting(true);
    setSendError(null);

    try {
      if (blockedByMe) {
        await unblockUser(user.id, otherUserId);
        const status = await getBlockStatus(otherUserId);
        setBlockedByMe(status.blockedByMe);
        setInteractionBlocked(status.interactionBlocked);
      } else {
        await blockUser(user.id, otherUserId);
        setBlockedByMe(true);
        setInteractionBlocked(true);
      }
    } catch (error) {
      setSendError(error instanceof Error ? error.message : t('blockUserError'));
    } finally {
      setBlockSubmitting(false);
    }
  }, [blockedByMe, blockSubmitting, conversation, t, user]);

  const handleMarkSold = useCallback(async () => {
    if (!listing || !user || listing.userId !== user.id || listing.isSold || markingSold) return;

    setMarkingSold(true);
    setSendError(null);

    try {
      const soldListingId = await markListingSold(listing);
      const soldListing = { ...listing, id: soldListingId, isSold: true, updatedAt: new Date() };
      onListingSold?.(soldListing);
      setRatingListing(soldListing);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : t('markSoldError'));
    } finally {
      setMarkingSold(false);
    }
  }, [listing, markingSold, onListingSold, t, user]);

  const openSafetyMenu = useCallback(() => {
    if (!conversation || !user) {
      setReportOpen(true);
      return;
    }

    const canMarkSold = !!listing && listing.userId === user.id && !listing.isSold;

    const options: { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }[] = [];

    if (canMarkSold) {
      options.push({ text: t('markAsSold'), onPress: handleMarkSold });
    }

    options.push({ text: t('reportUser'), onPress: () => setReportOpen(true) });
    options.push({
      text: blockedByMe ? t('unblockUser') : t('blockUser'),
      style: blockedByMe ? 'default' : 'destructive',
      onPress: () => {
        if (blockedByMe) {
          handleToggleBlock();
          return;
        }

        Alert.alert(t('blockUser'), t('blockUserConfirmation'), [
          { text: t('cancel'), style: 'cancel' },
          { text: t('blockUser'), style: 'destructive', onPress: handleToggleBlock },
        ]);
      },
    });
    options.push({ text: t('cancel'), style: 'cancel' });

    Alert.alert(t('safetyActions'), undefined, options);
  }, [blockedByMe, conversation, handleMarkSold, handleToggleBlock, listing, t, user]);

  const handleOpenSwish = useCallback(async () => {
    try {
      const supported = await Linking.canOpenURL('swish://');
      if (!supported) {
        Alert.alert(t('swishSectionTitle'), t('swishNotInstalled'));
        return;
      }
      await Linking.openURL('swish://');
    } catch {
      Alert.alert(t('swishSectionTitle'), t('swishOpenError'));
    }
  }, [t]);

  const closeFromSwipe = useCallback(() => {
    Animated.timing(screenTranslateX, {
      toValue: Dimensions.get('window').width,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      screenTranslateX.setValue(0);
      onClose();
    });
  }, [onClose, screenTranslateX]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dx > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
        onPanResponderMove: (_, gesture) => {
          screenTranslateX.setValue(Math.max(0, gesture.dx));
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx > 100 || gesture.vx > 1.1) {
            closeFromSwipe();
            return;
          }

          Animated.spring(screenTranslateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(screenTranslateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        },
      }),
    [closeFromSwipe, screenTranslateX],
  );

  if (!listing) return null;

  const isSeller = !!user && listing.userId === user.id;
  const otherPartyName = isSeller ? (conversation?.buyerName ?? t('buyer')) : (listing.sellerName ?? t('seller'));
  const otherPartyAvatarUrl = isSeller ? conversation?.buyerAvatarUrl : listing.sellerAvatarUrl;
  const listingMeta = [
    listing.eventName,
    listing.eventDate ? formatListingEventDate(listing.eventDate, language) : null,
    `${formatTicketQuantity(listing.quantity)} st`,
  ].filter(Boolean).join(' · ');

  return (
    <Modal
      animationType="slide"
      visible={!!listing}
      onRequestClose={onClose}
      statusBarTranslucent>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.screen,
          {
            backgroundColor: theme.background,
            transform: [{ translateX: screenTranslateX }],
          },
        ]}>
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: theme.backgroundHeader,
              borderBottomColor: theme.backgroundSelected,
              paddingTop: insets.top + Spacing.one,
            },
          ]}>
          <Pressable onPress={onClose} style={styles.backButton} hitSlop={8}>
            <ThemedText style={styles.backIcon}>‹</ThemedText>
          </Pressable>
          {otherPartyAvatarUrl ? (
            <Image contentFit="cover" source={{ uri: otherPartyAvatarUrl }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarFallback, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText style={styles.headerAvatarFallbackText} themeColor="textSecondary">
                {otherPartyName[0]?.toUpperCase() ?? '?'}
              </ThemedText>
            </View>
          )}
          <View style={styles.headerCenter}>
            <ThemedText numberOfLines={1} style={styles.headerTitle}>
              {otherPartyName}
            </ThemedText>
            <View style={styles.headerMetaRow}>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.headerMetaText}>
                {listingMeta}
              </ThemedText>
              {!isSeller && ratingSummary && (
                <View style={styles.sellerRatingBadge}>
                  <ThemedText
                    style={[
                      styles.sellerRatingEmoji,
                      { transform: [{ rotate: `${-(5 - Math.round(ratingSummary.average)) * 45}deg` }] },
                    ]}>
                    👍
                  </ThemedText>
                  <ThemedText style={styles.sellerRatingCount}>({ratingSummary.count})</ThemedText>
                </View>
              )}
            </View>
          </View>
          <View style={styles.headerRight}>
            <Pressable
              accessibilityLabel="Rapportera"
              disabled={blockSubmitting || markingSold}
              hitSlop={8}
              onPress={openSafetyMenu}
              style={styles.moreButton}>
              <ThemedText style={styles.moreIcon}>⋯</ThemedText>
            </Pressable>
          </View>
        </View>

        {!isSeller && sellerSwishNumber && !interactionBlocked && (
          <View style={[styles.swishBar, { backgroundColor: theme.backgroundElement, borderBottomColor: theme.backgroundSelected }]}>
            <Pressable
              onPress={handleCopySwishNumber}
              style={({ pressed }) => [
                styles.swishActionButton,
                { backgroundColor: pressed ? theme.backgroundSelected : 'transparent' },
              ]}>
              <ThemedText style={styles.swishActionButtonText}>
                {swishNumberCopied ? t('copiedLabel') : t('copyNumber')}
              </ThemedText>
            </Pressable>
            <View style={[styles.swishActionDivider, { backgroundColor: theme.backgroundSelected }]} />
            <Pressable
              onPress={handleOpenSwish}
              style={({ pressed }) => [
                styles.swishActionButton,
                { backgroundColor: pressed ? theme.backgroundSelected : 'transparent' },
              ]}>
              <ThemedText style={styles.swishActionButtonText}>{t('openSwishApp')}</ThemedText>
            </Pressable>
          </View>
        )}

        {/* Messages */}
        <View style={styles.flex}>
          {!user ? (
            <View style={styles.centerNotice}>
              <ThemedText type="small" themeColor="textSecondary">
                Logga in för att chatta.
              </ThemedText>
            </View>
          ) : loading ? (
            <View style={styles.centerNotice}>
              <ActivityIndicator size="small" color={theme.textSecondary} />
            </View>
          ) : loadError ? (
            <View style={styles.centerNotice}>
              <ThemedText type="small" themeColor="textSecondary">
                {loadError}
              </ThemedText>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => m.id}
              contentContainerStyle={[
                styles.messageList,
                { paddingBottom: keyboardHeight + insets.bottom + 96 },
              ]}
              onContentSizeChange={scrollToBottom}
              renderItem={({ item, index }) => (
                <MessageBubble
                  message={item}
                  showDate={
                    index === 0 ||
                    messages[index - 1].sentAt.getMinutes() !== item.sentAt.getMinutes()
                  }
                />
              )}
              ListEmptyComponent={
                <View style={styles.centerNotice}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Inga meddelanden än. Säg hej!
                  </ThemedText>
                </View>
              }
            />
          )}

          {/* Input bar */}
          {user && !loading && !loadError && interactionBlocked && (
            <View
              style={[
                styles.blockedNotice,
                { backgroundColor: theme.backgroundElement, borderTopColor: theme.backgroundSelected },
              ]}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.blockedNoticeText}>
                {t('blockedConversation')}
              </ThemedText>
              {blockedByMe && (
                <Pressable disabled={blockSubmitting} onPress={handleToggleBlock}>
                  <ThemedText style={styles.unblockAction}>{t('unblockUser')}</ThemedText>
                </Pressable>
              )}
            </View>
          )}

          {user && !loading && !loadError && !interactionBlocked && (
            <View
              style={[
                styles.inputBar,
                {
                  backgroundColor: theme.backgroundElement,
                  borderTopColor: theme.backgroundSelected,
                  bottom: keyboardHeight,
                  paddingBottom: keyboardHeight > 0 ? Spacing.two : insets.bottom + Spacing.two,
                },
              ]}>
              <View style={styles.inputRow}>
                <TextInput
                  value={draft}
                  onChangeText={handleDraftChange}
                  placeholder="Skriv ett meddelande..."
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  submitBehavior="submit"
                  editable={!sending}
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.backgroundSelected,
                      color: theme.text,
                    },
                  ]}
                  onSubmitEditing={handleSend}
                  returnKeyType="send"
                />
                <Pressable
                  onPress={handleSend}
                  disabled={sending}
                  style={[
                    styles.sendButton,
                    { opacity: draft.trim() && !sending ? 1 : 0.3 },
                  ]}>
                  <ThemedText style={styles.sendIcon}>↑</ThemedText>
                </Pressable>
              </View>
              {sendError && (
                <ThemedText style={styles.sendErrorText}>{sendError}</ThemedText>
              )}
            </View>
          )}
        </View>
      </Animated.View>

      <ReportModal
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        listing={listing}
        mode="chat"
      />

      <RatingModal listing={ratingListing} onClose={() => setRatingListing(null)} />
    </Modal>
  );
}

function MessageBubble({ message, showDate }: { message: Message; showDate: boolean }) {
  const theme = useTheme();
  const time = message.sentAt.toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={[styles.bubbleRow, message.fromMe && styles.bubbleRowMe]}>
      <View
        style={[
          styles.bubble,
          message.fromMe
            ? styles.bubbleMe
            : [styles.bubbleThem, { backgroundColor: theme.backgroundElement }],
        ]}>
        <ThemedText
          style={[styles.bubbleText, message.fromMe && styles.bubbleTextMe]}>
          {message.text}
        </ThemedText>
      </View>
      {showDate && (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={[styles.timestamp, message.fromMe && styles.timestampMe]}>
          {time}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },

  header: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: Spacing.two,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  backButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 28,
  },
  backIcon: {
    fontSize: 30,
    fontWeight: '400',
    lineHeight: 34,
  },
  headerAvatar: {
    borderRadius: 16,
    height: 32,
    marginRight: Spacing.two,
    width: 32,
  },
  headerAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarFallbackText: {
    fontSize: 13,
    fontWeight: '800',
  },
  headerCenter: {
    flex: 1,
    gap: 1,
  },
  headerMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.one,
  },
  headerMetaText: {
    flexShrink: 1,
  },
  sellerRatingBadge: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  sellerRatingEmoji: {
    fontSize: 12,
  },
  sellerRatingCount: {
    color: '#9AA3B2',
    fontSize: 11,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  headerRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'flex-end',
  },
  moreButton: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 24,
  },
  moreIcon: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 20,
  },

  swishBar: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.one,
  },
  swishActionButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 38,
  },
  swishActionButtonText: {
    color: '#4F6FB7',
    fontSize: 13,
    fontWeight: '800',
  },
  swishActionDivider: {
    height: 20,
    width: StyleSheet.hairlineWidth,
  },

  centerNotice: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
  },

  messageList: {
    flexGrow: 1,
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },

  bubbleRow: {
    alignItems: 'flex-start',
    gap: 3,
    marginBottom: Spacing.one,
  },
  bubbleRowMe: {
    alignItems: 'flex-end',
  },
  bubble: {
    borderRadius: 18,
    maxWidth: '78%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  bubbleMe: {
    backgroundColor: '#1D2430',
    borderBottomRightRadius: 5,
  },
  bubbleThem: {
    borderBottomLeftRadius: 5,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleTextMe: {
    color: '#FFFFFF',
  },
  timestamp: {
    fontSize: 11,
    marginHorizontal: Spacing.two,
  },
  timestampMe: {
    textAlign: 'right',
  },

  inputBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  blockedNotice: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    gap: Spacing.one,
    left: 0,
    paddingBottom: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    position: 'absolute',
    right: 0,
  },
  blockedNoticeText: {
    textAlign: 'center',
  },
  unblockAction: {
    color: '#4F6FB7',
    fontSize: 13,
    fontWeight: '800',
  },
  inputRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  input: {
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    fontSize: 15,
    maxHeight: 100,
    minHeight: 42,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#1D2430',
    borderRadius: 21,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  sendIcon: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
  },
  sendErrorText: {
    color: '#C84646',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: Spacing.one,
  },
});

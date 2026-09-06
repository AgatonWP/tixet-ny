import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatModal } from '@/components/chat-modal';
import { NationEmblem } from '@/components/nation-emblem';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, SecondaryHeaderHeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import {
  Conversation,
  Message,
  fetchConversationsForUser,
  fetchLatestMessages,
} from '@/lib/messages';
import { Listing, fetchListingsByIds, formatRelativeTime } from '@/lib/tickets';
import { useUnreadMessages } from '@/lib/unread-messages';

type InboxItem = {
  conversation: Conversation;
  listing: Listing;
  lastMessage: Message | null;
  isSeller: boolean;
};

export default function MessagesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { initializing, user } = useAuth();
  const { t } = useI18n();
  const { unreadConversationIds, refresh: refreshUnreadMessages } = useUnreadMessages();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [openItem, setOpenItem] = useState<InboxItem | null>(null);

  const loadInbox = useCallback(async (isActive: () => boolean = () => true) => {
    if (!user) {
      if (isActive()) setItems([]);
      return;
    }

    if (isActive()) setError(null);

    try {
      const conversations = await fetchConversationsForUser(user.id);
      const listingIds = [...new Set(conversations.map((c) => c.listingId))];
      const [listings, latestByConversation] = await Promise.all([
        fetchListingsByIds(listingIds),
        fetchLatestMessages(conversations.map((c) => c.id), user.id),
      ]);

      const listingById = new Map(listings.map((listing) => [listing.id, listing]));

      const nextItems = conversations
        .map((conversation): InboxItem | null => {
          const listing = listingById.get(conversation.listingId);
          if (!listing) return null;

          return {
            conversation,
            listing,
            lastMessage: latestByConversation.get(conversation.id) ?? null,
            isSeller: conversation.sellerId === user.id,
          };
        })
        .filter((item): item is InboxItem => item !== null && item.lastMessage !== null)
        .sort((a, b) => {
          const aTime = a.lastMessage?.sentAt.getTime() ?? a.conversation.createdAt.getTime();
          const bTime = b.lastMessage?.sentAt.getTime() ?? b.conversation.createdAt.getTime();
          return bTime - aTime;
        });

      if (!isActive()) return;
      setItems(nextItems);
    } catch (err) {
      if (!isActive()) return;
      setError(err instanceof Error ? err.message : t('messagesFetchError'));
    }
  }, [t, user]);

  useEffect(() => {
    if (initializing) return;

    if (!user) {
      setItems([]);
      return;
    }

    let isMounted = true;
    setLoading(true);
    loadInbox(() => isMounted).finally(() => {
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [initializing, user, loadInbox]);

  // unreadConversationIds changes whenever a new message arrives anywhere (or
  // gets marked read), via the global realtime subscription in
  // UnreadMessagesProvider. Reloading here keeps the inbox order live while
  // this screen stays open, instead of only on mount/focus.
  useEffect(() => {
    if (initializing || !user) return;
    loadInbox();
  }, [unreadConversationIds, initializing, user, loadInbox]);

  // Tab screens stay mounted when you switch away, so refresh the inbox
  // whenever Messages becomes visible again.
  useFocusEffect(
    useCallback(() => {
      if (initializing) return;

      let isActive = true;

      if (user) {
        loadInbox(() => isActive);
        refreshUnreadMessages();
      } else {
        setItems([]);
      }

      return () => {
        isActive = false;
      };
    }, [initializing, loadInbox, refreshUnreadMessages, user]),
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    loadInbox().finally(() => setRefreshing(false));
  }, [loadInbox]);
  const unreadConversationIdSet = useMemo(
    () => new Set(unreadConversationIds),
    [unreadConversationIds],
  );

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView edges={['top']} style={[styles.header, { borderBottomColor: theme.backgroundSelected, backgroundColor: theme.backgroundHeader }]}>
        <View style={styles.headerInner}>
          <ThemedText style={styles.headerTitle}>{t('messages')}</ThemedText>
        </View>
      </SafeAreaView>

      {!initializing && !user ? (
        <View style={styles.centerNotice}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('messagesLoginRequired')}
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.conversation.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.textSecondary} colors={['#1D2430']} />
          }
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + BottomTabInset + Spacing.four },
          ]}
          renderItem={({ item }) => (
            <InboxRow
              item={item}
              isUnread={unreadConversationIdSet.has(item.conversation.id)}
              onPress={() => setOpenItem(item)}
            />
          )}
          ListEmptyComponent={
            (initializing || loading) ? (
              <View style={styles.centerNotice}>
                <ActivityIndicator size="small" color={theme.textSecondary} />
              </View>
            ) : (
              <View style={styles.centerNotice}>
                <ThemedText style={styles.emptyTitle}>{t('noMessagesYet')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyCopy}>
                  {error ?? t('startChatHint')}
                </ThemedText>
              </View>
            )
          }
        />
      )}

      <ChatModal
        listing={openItem?.listing ?? null}
        conversationId={openItem?.conversation.id}
        onClose={() => setOpenItem(null)}
        onListingSold={(soldListing) => {
          setItems((current) =>
            current.map((item) =>
              item.listing.id === soldListing.id ? { ...item, listing: soldListing } : item,
            ),
          );
          setOpenItem((current) =>
            current && current.listing.id === soldListing.id ? { ...current, listing: soldListing } : current,
          );
        }}
      />
    </ThemedView>
  );
}

function InboxRow({ item, isUnread, onPress }: { item: InboxItem; isUnread: boolean; onPress: () => void }) {
  const theme = useTheme();
  const { t } = useI18n();
  const otherPartyName = item.isSeller ? (item.conversation.buyerName ?? t('buyer')) : (item.listing.sellerName ?? t('seller'));
  const previewText = item.lastMessage
    ? `${item.listing.eventName} · ${item.lastMessage.text}`
    : `${item.listing.eventName} · ${t('noChatYet')}`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        isUnread && styles.rowUnread,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: isUnread ? '#C84646' : theme.backgroundSelected,
          opacity: pressed ? 0.72 : item.listing.isSold ? 0.55 : 1,
        },
      ]}>
      <NationEmblem nationId={item.listing.nationId} />
      <View style={styles.rowCopy}>
        <View style={styles.rowTitleLine}>
          <ThemedText numberOfLines={1} style={[styles.rowTitle, isUnread && styles.rowTitleUnread]}>
            {otherPartyName}
          </ThemedText>
          <View style={[styles.roleBadge, item.isSeller ? styles.roleBadgeSeller : styles.roleBadgeBuyer]}>
            <ThemedText style={styles.roleBadgeText}>{item.isSeller ? t('seller') : t('buyer')}</ThemedText>
          </View>
          {item.listing.isSold && (
            <View style={styles.soldBadge}>
              <ThemedText style={styles.soldBadgeText}>{t('sold')}</ThemedText>
            </View>
          )}
        </View>
        <ThemedText
          numberOfLines={1}
          type="small"
          themeColor={isUnread ? 'text' : 'textSecondary'}
          style={isUnread && styles.rowPreviewUnread}>
          {previewText}
        </ThemedText>
      </View>
      {item.lastMessage && (
        <View style={styles.rowMeta}>
          <ThemedText
            type="small"
            themeColor={isUnread ? 'text' : 'textSecondary'}
            style={isUnread && styles.rowTimeUnread}>
            {formatRelativeTime(item.lastMessage.sentAt)}
          </ThemedText>
          {isUnread && <View style={styles.rowUnreadDot} />}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerInner: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: SecondaryHeaderHeight,
    paddingHorizontal: Spacing.three,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  listContent: {
    alignSelf: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    width: '100%',
  },
  centerNotice: {
    alignItems: 'center',
    flex: 1,
    gap: Spacing.one,
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.six,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  emptyCopy: {
    textAlign: 'center',
  },
  row: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.two,
    minHeight: 68,
    padding: Spacing.two,
  },
  rowUnread: {
    borderWidth: 1.5,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  rowTitleLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  rowTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  rowTitleUnread: {
    fontWeight: '900',
  },
  rowPreviewUnread: {
    fontWeight: '800',
  },
  rowMeta: {
    alignItems: 'flex-end',
    gap: 5,
  },
  rowTimeUnread: {
    fontWeight: '800',
  },
  rowUnreadDot: {
    backgroundColor: '#C84646',
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  roleBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  roleBadgeSeller: {
    backgroundColor: '#EAF0FF',
  },
  roleBadgeBuyer: {
    backgroundColor: '#FFC8A5CC',
  },
  roleBadgeText: {
    color: '#1D2430',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  soldBadge: {
    backgroundColor: '#EEF0F4',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  soldBadgeText: {
    color: '#687283',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});

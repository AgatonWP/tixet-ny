import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { NationEmblem } from '@/components/nation-emblem';
import { RatingModal } from '@/components/rating-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, SecondaryHeaderHeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { saveOwnSwishNumber } from '@/lib/payment-details';
import { Rating, RatingSummary, fetchOwnRatingsForListings, fetchRatingSummary } from '@/lib/ratings';
import {
  Listing,
  SOLD_LISTING_KEEP_MS,
  deleteListing,
  fetchMyListings,
  formatListingEventDate,
  formatTicketQuantity,
  getListingOrganizerName,
  markListingSold,
  restoreListingActive,
} from '@/lib/tickets';

const MAX_DISPLAY_NAME_LENGTH = 25;

export default function ProfileScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const theme = useTheme();
  const { initializing, user, signIn, signOut, signUp } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [confirmationEmailSent, setConfirmationEmailSent] = useState(false);
  const [signupFullName, setSignupFullName] = useState('');
  const [signupSwishNumber, setSignupSwishNumber] = useState('');
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsError, setListingsError] = useState<string | null>(null);
  const [pendingListingId, setPendingListingId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Listing | null>(null);
  const [ratingListing, setRatingListing] = useState<Listing | null>(null);
  const [ownRatings, setOwnRatings] = useState<Map<string, Rating>>(new Map());
  const [ownRatingSummary, setOwnRatingSummary] = useState<RatingSummary | null>(null);

  useEffect(() => {
    if (!user) {
      setOwnRatingSummary(null);
      return;
    }

    let active = true;
    fetchRatingSummary(user.id)
      .then((summary) => {
        if (active) setOwnRatingSummary(summary.count > 0 ? summary : null);
      })
      .catch(() => {
        if (active) setOwnRatingSummary(null);
      });

    return () => {
      active = false;
    };
  }, [user]);

  const loadListings = useCallback(async () => {
    if (!user) {
      setListings([]);
      return;
    }

    setListingsLoading(true);
    setListingsError(null);

    try {
      setListings(await fetchMyListings(user.id));
    } catch (error) {
      setListingsError(error instanceof Error ? error.message : t('listingFetchErrorSentence'));
    } finally {
      setListingsLoading(false);
    }
  }, [t, user]);

  useEffect(() => {
    if (!initializing && user) {
      loadListings();
    } else if (!user) {
      setListings([]);
      setListingsLoading(false);
      setListingsError(null);
      setDeleteCandidate(null);
      setPendingListingId(null);
    }
  }, [initializing, loadListings, user]);

  // Tab screens stay mounted when you switch away, so without this a
  // listing posted elsewhere (e.g. the sell flow) wouldn't show up here
  // until the app fully reloads.
  useFocusEffect(
    useCallback(() => {
      if (!initializing && user) {
        loadListings();
      }
    }, [initializing, loadListings, user]),
  );

  const activeListings = useMemo(() => listings.filter((listing) => !listing.isSold), [listings]);
  const soldListings = useMemo(
    () =>
      listings.filter(
        (listing) => listing.isSold && Date.now() - listing.updatedAt.getTime() < SOLD_LISTING_KEEP_MS,
      ),
    [listings],
  );

  useEffect(() => {
    if (soldListings.length === 0) {
      setOwnRatings(new Map());
      return;
    }

    let active = true;
    fetchOwnRatingsForListings(soldListings.map((listing) => listing.id))
      .then((ratings) => {
        if (active) setOwnRatings(ratings);
      })
      .catch(() => {
        // Non-critical: the "rate buyer" affordance just won't reflect prior state.
      });

    return () => {
      active = false;
    };
  }, [soldListings]);

  async function handleAuthSubmit() {
    if (!email.trim() || !password) return;

    setSubmitting(true);
    setAuthError(null);
    setConfirmationEmailSent(false);

    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
      } else {
        const { userId, needsEmailConfirmation } = await signUp(email.trim(), password, {
          fullName: signupFullName.trim(),
        });

        if (needsEmailConfirmation) {
          setConfirmationEmailSent(true);
        } else if (signupSwishNumber.trim()) {
          // No confirmation needed, so there's already a session to save with.
          await saveOwnSwishNumber(userId, signupSwishNumber.trim()).catch(() => {
            // Non-critical: the account still exists without it, can be added in Settings.
          });
        }

        setSignupFullName('');
        setSignupSwishNumber('');
      }
      setPassword('');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : t('authGenericError'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    setSubmitting(true);
    setAuthError(null);

    try {
      await signOut();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : t('signOutError'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteListing() {
    if (!user || !deleteCandidate || pendingListingId) return;

    const listingId = deleteCandidate.id;
    setPendingListingId(listingId);
    setListingsError(null);

    try {
      await deleteListing(listingId, user.id);
      setListings((current) => current.filter((item) => item.id !== listingId));
      setDeleteCandidate(null);
    } catch (error) {
      setListingsError(error instanceof Error ? error.message : t('deleteListingError'));
    } finally {
      setPendingListingId(null);
    }
  }

  async function handleMarkSold() {
    if (!user || !deleteCandidate || pendingListingId || deleteCandidate.isSold) return;

    const listing = deleteCandidate;
    setPendingListingId(listing.id);
    setListingsError(null);

    try {
      const soldListingId = await markListingSold(listing);
      const soldListing = { ...listing, id: soldListingId, isSold: true, updatedAt: new Date() };
      setListings((current) =>
        current.map((item) => (item.id === listing.id ? soldListing : item)),
      );
      setDeleteCandidate(null);
      setRatingListing(soldListing);
    } catch (error) {
      setListingsError(error instanceof Error ? error.message : t('markSoldError'));
      setDeleteCandidate(null);
    } finally {
      setPendingListingId(null);
    }
  }

  async function handleRestoreListing() {
    if (!user || !deleteCandidate || pendingListingId || !deleteCandidate.isSold) return;

    const listing = deleteCandidate;
    setPendingListingId(listing.id);
    setListingsError(null);

    try {
      await restoreListingActive(listing);
      setListings((current) =>
        current.map((item) => (item.id === listing.id ? { ...item, isSold: false } : item)),
      );
      setDeleteCandidate(null);
    } catch (error) {
      setListingsError(error instanceof Error ? error.message : t('restoreListingError'));
      setDeleteCandidate(null);
    } finally {
      setPendingListingId(null);
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView edges={['top']} style={[styles.header, { borderBottomColor: theme.backgroundSelected, backgroundColor: theme.backgroundHeader }]}>
        <View style={styles.headerInner}>
          <View style={styles.headerSide} />
          <ThemedText style={styles.headerTitle}>{t('profile')}</ThemedText>
          <View style={styles.headerRight}>
            {user ? (
              <Pressable
                accessibilityLabel="Inställningar"
                hitSlop={16}
                onPress={() => router.push('/settings')}
                style={({ pressed }) => [styles.settingsButton, pressed && styles.settingsButtonPressed]}>
                <Ionicons color={theme.text} name="settings-outline" size={22} />
              </Pressable>
            ) : (
              <View style={styles.settingsButton} />
            )}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={[styles.scrollView, { backgroundColor: theme.background }]}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four,
          },
        ]}>
        <View style={styles.container}>
          {initializing ? (
            <View style={[styles.authPanel, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
              <ActivityIndicator size="small" color={theme.textSecondary} />
            </View>
          ) : user ? (
            <>
              <View style={styles.profileRow}>
                {user.user_metadata?.avatar_url ? (
                  <Image
                    contentFit="cover"
                    source={{ uri: user.user_metadata.avatar_url }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={styles.avatar}>
                    <ThemedText style={styles.avatarText}>
                      {(user.email?.[0] ?? 'T').toUpperCase()}
                    </ThemedText>
                  </View>
                )}
                <View style={styles.profileCopy}>
                  <View style={styles.profileNameRow}>
                    <ThemedText numberOfLines={1} style={styles.profileName}>
                      {user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Forkop'}
                    </ThemedText>
                    {ownRatingSummary && (
                      <View style={styles.ownRatingBadge}>
                        <ThemedText
                          style={[
                            styles.ownRatingEmoji,
                            { transform: [{ rotate: `${-(5 - Math.round(ownRatingSummary.average)) * 45}deg` }] },
                          ]}>
                          👍
                        </ThemedText>
                        <ThemedText style={styles.ownRatingCount}>({ownRatingSummary.count})</ThemedText>
                      </View>
                    )}
                  </View>
                  <ThemedText numberOfLines={1} type="small" themeColor="textSecondary">
                    {user.email}
                  </ThemedText>
                </View>
                <Pressable
                  disabled={submitting}
                  onPress={handleSignOut}
                  style={[styles.outlineButton, { borderColor: theme.backgroundSelected, opacity: submitting ? 0.6 : 1 }]}>
                  <ThemedText style={styles.outlineButtonText}>{t('signOut')}</ThemedText>
                </Pressable>
              </View>

              <ProfileSection title={t('activeListings')} count={activeListings.length}>
                {listingsLoading ? (
                  <SectionNotice text={t('loadingListings')} loading />
                ) : activeListings.length > 0 ? (
                  activeListings.map((listing) => (
                    <ListingRow
                      key={listing.id}
                      listing={listing}
                      pending={pendingListingId === listing.id}
                      onDelete={() => setDeleteCandidate(listing)}
                    />
                  ))
                ) : (
                  <SectionNotice text={t('noActiveListings')} />
                )}
              </ProfileSection>

              <ProfileSection title={t('soldListings')} count={soldListings.length}>
                {listingsLoading ? (
                  <SectionNotice text={t('loadingListings')} loading />
                ) : soldListings.length > 0 ? (
                  soldListings.map((listing) => (
                    <ListingRow
                      key={listing.id}
                      listing={listing}
                      pending={pendingListingId === listing.id}
                      sold
                      rating={ownRatings.get(listing.id)}
                      onDelete={() => setDeleteCandidate(listing)}
                      onRate={() => setRatingListing(listing)}
                    />
                  ))
                ) : (
                  <SectionNotice text={t('noSoldListings')} />
                )}
              </ProfileSection>

              {listingsError && <ThemedText style={styles.errorText}>{listingsError}</ThemedText>}
            </>
          ) : (
            <View style={[styles.authPanel, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
              <View style={styles.authHeader}>
                <ThemedText style={styles.authTitle}>
                  {mode === 'signin' ? t('signIn') : t('signUp')}
                </ThemedText>
                <Pressable
                  onPress={() => {
                    setMode(mode === 'signin' ? 'signup' : 'signin');
                    setAuthError(null);
                    setConfirmationEmailSent(false);
                    setSignupFullName('');
                    setSignupSwishNumber('');
                  }}>
                  <ThemedText style={styles.authSwitch}>
                    {mode === 'signin' ? t('signUp') : t('signIn')}
                  </ThemedText>
                </Pressable>
              </View>

              {confirmationEmailSent && (
                <ThemedText type="small" style={styles.confirmationNotice}>
                  {t('confirmEmailNotice')}
                </ThemedText>
              )}

              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onChangeText={(text) => {
                  setEmail(text);
                  setConfirmationEmailSent(false);
                }}
                placeholder="Email"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.backgroundSelected,
                    color: theme.text,
                  },
                ]}
                value={email}
              />
              <TextInput
                autoCapitalize="none"
                onChangeText={setPassword}
                placeholder={t('password')}
                placeholderTextColor={theme.textSecondary}
                secureTextEntry
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.backgroundSelected,
                    color: theme.text,
                  },
                ]}
                value={password}
              />

              {mode === 'signup' && (
                <>
                  <TextInput
                    maxLength={MAX_DISPLAY_NAME_LENGTH}
                    onChangeText={(text) => setSignupFullName(text.replace(/[^\p{L}\s]/gu, ''))}
                    placeholder={t('displayNameOptionalPlaceholder')}
                    placeholderTextColor={theme.textSecondary}
                    style={[
                      styles.input,
                      { backgroundColor: theme.background, borderColor: theme.backgroundSelected, color: theme.text },
                    ]}
                    value={signupFullName}
                  />
                  <TextInput
                    keyboardType="phone-pad"
                    onChangeText={(text) => setSignupSwishNumber(text.replace(/[^\d\s+-]/g, ''))}
                    placeholder={t('swishNumberOptionalPlaceholder')}
                    placeholderTextColor={theme.textSecondary}
                    style={[
                      styles.input,
                      { backgroundColor: theme.background, borderColor: theme.backgroundSelected, color: theme.text },
                    ]}
                    value={signupSwishNumber}
                  />
                </>
              )}

              {authError && <ThemedText style={styles.errorText}>{authError}</ThemedText>}

              <Pressable
                disabled={submitting || !email.trim() || !password}
                onPress={handleAuthSubmit}
                style={[
                  styles.primaryButton,
                  { opacity: submitting || !email.trim() || !password ? 0.55 : 1 },
                ]}>
                <ThemedText style={styles.primaryButtonText}>
                  {submitting ? t('wait') : mode === 'signin' ? t('signIn') : t('signUp')}
                </ThemedText>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      <ListingActionModal
        listing={deleteCandidate}
        pending={pendingListingId === deleteCandidate?.id}
        onCancel={() => setDeleteCandidate(null)}
        onDelete={handleDeleteListing}
        onMarkSold={handleMarkSold}
        onRestore={handleRestoreListing}
      />
      <RatingModal
        listing={ratingListing}
        onClose={() => setRatingListing(null)}
        onSubmitted={() => {
          if (!ratingListing) return;
          fetchOwnRatingsForListings([ratingListing.id]).then((ratings) => {
            const rating = ratings.get(ratingListing.id);
            if (!rating) return;
            setOwnRatings((current) => new Map(current).set(ratingListing.id, rating));
          });
        }}
      />
    </ThemedView>
  );
}

function ProfileSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>
        {title} ({count})
      </ThemedText>
      <View style={styles.sectionRows}>{children}</View>
    </View>
  );
}

function SectionNotice({ text, loading = false }: { text: string; loading?: boolean }) {
  const theme = useTheme();

  return (
    <View style={[styles.noticeRow, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
      {loading && <ActivityIndicator size="small" color={theme.textSecondary} />}
      <ThemedText type="small" themeColor="textSecondary">
        {text}
      </ThemedText>
    </View>
  );
}

function ListingRow({
  listing,
  sold = false,
  pending = false,
  rating,
  onDelete,
  onRate,
}: {
  listing: Listing;
  sold?: boolean;
  pending?: boolean;
  rating?: Rating;
  onDelete: () => void;
  onRate?: () => void;
}) {
  const theme = useTheme();
  const { language, t } = useI18n();
  const nationName = getListingOrganizerName(listing);
  const listingMeta = [
    nationName,
    listing.eventDate ? formatListingEventDate(listing.eventDate, language) : null,
    `${formatTicketQuantity(listing.quantity)} ${t('pcs')}`,
  ].filter(Boolean).join(' · ');
  const showTradeBadge = listing.dealType === 'trade' || listing.dealType === 'both';

  return (
    <View
      style={[
        styles.listingRow,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.backgroundSelected,
          opacity: sold ? 0.6 : 1,
        },
      ]}>
      <NationEmblem nationId={listing.nationId} />

      <View style={styles.listingCopy}>
        <ThemedText numberOfLines={1} style={styles.listingTitle}>
          {listing.eventName}
        </ThemedText>
        <ThemedText numberOfLines={1} type="small" themeColor="textSecondary">
          {listingMeta}
        </ThemedText>
      </View>

      {showTradeBadge && !sold && (
        <View style={styles.tradeBadge}>
          <ThemedText style={styles.tradeBadgeText}>{t('trade')}</ThemedText>
        </View>
      )}

      {sold ? (
        <>
          {rating ? (
            <View style={styles.ratedBadge}>
              <ThemedText
                style={[styles.ratedBadgeEmoji, { transform: [{ rotate: `${-(5 - rating.score) * 45}deg` }] }]}>
                👍
              </ThemedText>
            </View>
          ) : (
            onRate && (
              <Pressable onPress={onRate} style={styles.rateButton}>
                <ThemedText style={styles.rateButtonText}>{t('rateBuyerAction')}</ThemedText>
              </Pressable>
            )
          )}
          <View style={styles.soldBadge}>
            <ThemedText style={styles.soldBadgeText}>{t('sold')}</ThemedText>
          </View>
          <Pressable
            accessibilityLabel="Ta bort annons"
            disabled={pending}
            onPress={onDelete}
            style={[styles.iconButton, styles.deleteButton, { borderColor: theme.backgroundSelected, opacity: pending ? 0.5 : 1 }]}>
            <ThemedText style={styles.deleteButtonText}>×</ThemedText>
          </Pressable>
        </>
      ) : (
        <View style={styles.actionGroup}>
          <Pressable
            accessibilityLabel="Ta bort annons"
            disabled={pending}
            onPress={onDelete}
            style={[styles.iconButton, styles.deleteButton, { borderColor: theme.backgroundSelected, opacity: pending ? 0.5 : 1 }]}>
            <ThemedText style={styles.deleteButtonText}>×</ThemedText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function ListingActionModal({
  listing,
  pending,
  onCancel,
  onDelete,
  onMarkSold,
  onRestore,
}: {
  listing: Listing | null;
  pending: boolean;
  onCancel: () => void;
  onDelete: () => void;
  onMarkSold: () => void;
  onRestore: () => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const showMarkSold = !!listing && !listing.isSold;
  const showRestore = !!listing && listing.isSold;

  return (
    <Modal
      visible={!!listing}
      animationType="fade"
      transparent
      onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.confirmCard, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
          <ThemedText style={styles.confirmTitle}>{t('manageListing')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.confirmCopy}>
            {listing ? listing.eventName : ''}
          </ThemedText>
          {showMarkSold && (
            <Pressable
              disabled={pending}
              onPress={onMarkSold}
              style={[styles.confirmButton, styles.markSoldButton, { opacity: pending ? 0.5 : 1 }]}>
              <ThemedText style={styles.markSoldButtonText}>
                {pending ? t('wait') : t('markAsSold')}
              </ThemedText>
            </Pressable>
          )}
          {showRestore && (
            <Pressable
              disabled={pending}
              onPress={onRestore}
              style={[styles.confirmButton, styles.markSoldButton, { opacity: pending ? 0.5 : 1 }]}>
              <ThemedText style={styles.markSoldButtonText}>
                {pending ? t('wait') : t('restoreListing')}
              </ThemedText>
            </Pressable>
          )}
          <View style={styles.confirmActions}>
            <Pressable
              disabled={pending}
              onPress={onCancel}
              style={[styles.confirmButton, { borderColor: theme.backgroundSelected, opacity: pending ? 0.5 : 1 }]}>
              <ThemedText style={styles.cancelButtonText}>{t('cancel')}</ThemedText>
            </Pressable>
            <Pressable
              disabled={pending}
              onPress={onDelete}
              style={[styles.confirmButton, styles.confirmDeleteButton, { opacity: pending ? 0.5 : 1 }]}>
              <ThemedText style={styles.confirmDeleteText}>
                {pending ? t('wait') : t('delete')}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
  headerSide: {
    width: 92,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
    textAlign: 'center',
  },
  headerRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'flex-end',
    width: 92,
  },
  settingsButton: {
    alignItems: 'center',
    borderRadius: 8,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  settingsButtonPressed: {
    opacity: 0.65,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
  },
  container: {
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
  },
  profileRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.three,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#EEF0F4',
    borderRadius: 32,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  avatarText: {
    color: '#687283',
    fontSize: 26,
    fontWeight: '800',
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
  },
  profileNameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.one,
  },
  profileName: {
    flexShrink: 1,
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 27,
  },
  ownRatingBadge: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  ownRatingEmoji: {
    fontSize: 15,
  },
  ownRatingCount: {
    color: '#9AA3B2',
    fontSize: 13,
    fontWeight: '700',
  },
  authPanel: {
    borderRadius: 8,
    borderWidth: 1,
    gap: Spacing.three,
    padding: Spacing.three,
  },
  authHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  authTitle: {
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 27,
  },
  authSwitch: {
    color: '#4F6FB7',
    fontSize: 13,
    fontWeight: '800',
  },
  confirmationNotice: {
    backgroundColor: '#EAF0FF',
    borderRadius: 8,
    color: '#2E4C9C',
    fontWeight: '700',
    padding: Spacing.two,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 46,
    paddingHorizontal: Spacing.three,
  },
  errorText: {
    color: '#C84646',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#1D2430',
    borderRadius: 8,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  outlineButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 36,
    paddingHorizontal: Spacing.two,
    justifyContent: 'center',
  },
  outlineButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  sectionRows: {
    gap: Spacing.two,
  },
  noticeRow: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.two,
    minHeight: 48,
    paddingHorizontal: Spacing.three,
  },
  listingRow: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.two,
    minHeight: 62,
    padding: Spacing.two,
  },
  listingCopy: {
    flex: 1,
    minWidth: 0,
  },
  listingTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  tradeBadge: {
    backgroundColor: '#4F6FB7',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tradeBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  soldBadge: {
    backgroundColor: '#EEF0F4',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  soldBadgeText: {
    color: '#687283',
    fontSize: 11,
    fontWeight: '800',
  },
  rateButton: {
    backgroundColor: '#1D2430',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  rateButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  ratedBadge: {
    alignItems: 'center',
    backgroundColor: '#DCF3E4',
    borderRadius: 999,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  ratedBadgeEmoji: {
    fontSize: 14,
  },
  actionGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  deleteButton: {
    backgroundColor: '#FFF7F7',
  },
  deleteButtonText: {
    color: '#C84646',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 20,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: '#1D243080',
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  confirmCard: {
    borderRadius: 8,
    borderWidth: 1,
    gap: Spacing.three,
    maxWidth: 360,
    padding: Spacing.four,
    width: '100%',
  },
  confirmTitle: {
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 24,
  },
  confirmCopy: {
    lineHeight: 19,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'flex-end',
  },
  confirmButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: Spacing.three,
  },
  markSoldButton: {
    backgroundColor: '#1D2430',
    borderColor: '#1D2430',
  },
  markSoldButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  confirmDeleteButton: {
    backgroundColor: '#C84646',
    borderColor: '#C84646',
  },
  confirmDeleteText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});

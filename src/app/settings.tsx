import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { checkIsAdmin } from '@/lib/admin';
import { pickAndUploadAvatar } from '@/lib/avatar';
import { useAuth } from '@/lib/auth';
import { Language, useI18n } from '@/lib/i18n';
import { fetchOwnSwishNumber, saveOwnSwishNumber } from '@/lib/payment-details';
import { disablePushNotifications, getPushEnabled, registerForPushNotifications } from '@/lib/push-notifications';
import { supabase } from '@/lib/supabase';
import { ThemeMode, useThemeMode } from '@/lib/theme-mode';

const MAX_DISPLAY_NAME_LENGTH = 25;

export default function SettingsScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const theme = useTheme();
  const { user } = useAuth();
  const { language, setLanguage, t } = useI18n();
  const { themeMode, setThemeMode } = useThemeMode();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.user_metadata?.avatar_url ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarToastVisible, setAvatarToastVisible] = useState(false);
  const avatarToastOpacity = useRef(new Animated.Value(0)).current;

  const [fullName, setFullName] = useState(user?.user_metadata?.full_name ?? '');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);

  const [phoneNumber, setPhoneNumber] = useState(user?.user_metadata?.phone_number ?? '');
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneSaved, setPhoneSaved] = useState(false);

  const [swishNumber, setSwishNumber] = useState(user?.user_metadata?.swish_number ?? '');
  const [swishSaving, setSwishSaving] = useState(false);
  const [swishError, setSwishError] = useState<string | null>(null);
  const [swishSaved, setSwishSaved] = useState(false);
  const [swishDeleting, setSwishDeleting] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(true);
  const [pushSubmitting, setPushSubmitting] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setAvatarUrl(user?.user_metadata?.avatar_url ?? null);
    setFullName(user?.user_metadata?.full_name ?? '');
    setPhoneNumber(user?.user_metadata?.phone_number ?? '');
  }, [user]);

  useEffect(() => {
    if (!user) {
      setSwishNumber('');
      return;
    }

    fetchOwnSwishNumber(user.id)
      .then(setSwishNumber)
      .catch(() => setSwishError(t('swishNumberLoadError')));
  }, [t, user]);

  useEffect(() => {
    if (!user) return;

    getPushEnabled(user.id)
      .then(setPushEnabled)
      .catch(() => setPushEnabled(false))
      .finally(() => setPushLoading(false));
  }, [user]);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }

    checkIsAdmin()
      .then(setIsAdmin)
      .catch(() => setIsAdmin(false));
  }, [user]);

  function showAvatarToast() {
    setAvatarToastVisible(true);
    avatarToastOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(avatarToastOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(avatarToastOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setAvatarToastVisible(false));
  }

  async function handleChangeAvatar() {
    if (!user || avatarUploading) return;

    setAvatarUploading(true);
    setAvatarError(null);

    try {
      const url = await pickAndUploadAvatar(user.id);
      if (url) {
        setAvatarUrl(url);
        showAvatarToast();
      }
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : t('avatarChangeError'));
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleSaveName() {
    if (!user || nameSaving || !fullName.trim()) return;

    setNameSaving(true);
    setNameError(null);
    setNameSaved(false);

    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH) },
      });

      if (error) throw new Error(error.message);
      setNameSaved(true);
    } catch (error) {
      setNameError(error instanceof Error ? error.message : t('nameSaveError'));
    } finally {
      setNameSaving(false);
    }
  }

  async function handleSavePhone() {
    if (!user || phoneSaving) return;

    setPhoneSaving(true);
    setPhoneError(null);
    setPhoneSaved(false);

    try {
      const { error } = await supabase.auth.updateUser({ data: { phone_number: phoneNumber.trim() } });

      if (error) throw new Error(error.message);
      setPhoneSaved(true);
    } catch (error) {
      setPhoneError(error instanceof Error ? error.message : t('phoneSaveError'));
    } finally {
      setPhoneSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!user || passwordSaving || newPassword.length < 6) return;

    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSaved(false);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) throw new Error(error.message);
      setPasswordSaved(true);
      setNewPassword('');
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : t('passwordSaveError'));
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleSaveSwish() {
    if (!user || swishSaving) return;

    setSwishSaving(true);
    setSwishError(null);
    setSwishSaved(false);

    try {
      await saveOwnSwishNumber(user.id, swishNumber);
      setSwishSaved(true);
    } catch (error) {
      setSwishError(error instanceof Error ? error.message : t('swishNumberSaveError'));
    } finally {
      setSwishSaving(false);
    }
  }

  async function handleDeleteSwish() {
    if (!user || swishDeleting) return;

    setSwishDeleting(true);
    setSwishError(null);

    try {
      await saveOwnSwishNumber(user.id, '');
      setSwishNumber('');
      setSwishSaved(false);
    } catch (error) {
      setSwishError(error instanceof Error ? error.message : t('swishNumberSaveError'));
    } finally {
      setSwishDeleting(false);
    }
  }

  function handleDeleteAccount() {
    if (!user || deletingAccount) return;

    Alert.alert(t('deleteAccountTitle'), t('deleteAccountConfirmation'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('deleteAccountButton'),
        style: 'destructive',
        onPress: async () => {
          setDeletingAccount(true);
          setDeleteAccountError(null);

          try {
            const { error } = await supabase.functions.invoke('delete-account', { method: 'DELETE' });
            if (error) throw error;

            await supabase.auth.signOut({ scope: 'local' });
            router.back();
          } catch (error) {
            setDeleteAccountError(error instanceof Error ? error.message : t('deleteAccountError'));
          } finally {
            setDeletingAccount(false);
          }
        },
      },
    ]);
  }

  async function handleTogglePush(next: boolean) {
    if (!user || pushSubmitting) return;

    setPushSubmitting(true);
    setPushError(null);

    try {
      if (next) {
        await registerForPushNotifications(user.id);
      } else {
        await disablePushNotifications(user.id);
      }
      setPushEnabled(next);
    } catch (error) {
      setPushError(error instanceof Error ? error.message : t('pushToggleError'));
    } finally {
      setPushSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.screen}>
      {avatarToastVisible && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.avatarToast,
            { top: safeAreaInsets.top + 56 + Spacing.two, opacity: avatarToastOpacity, backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
          ]}>
          <ThemedText style={styles.avatarToastText}>{t('avatarToastMessage')}</ThemedText>
        </Animated.View>
      )}
      <SafeAreaView edges={['top']} style={[styles.header, { borderBottomColor: theme.backgroundSelected, backgroundColor: theme.backgroundHeader }]}>
        <View style={styles.headerInner}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ThemedText style={styles.backButtonText}>‹</ThemedText>
          </Pressable>
          <ThemedText style={styles.headerTitle}>{t('settingsTitle')}</ThemedText>
        </View>
      </SafeAreaView>

      <ScrollView
        style={[styles.scrollView, { backgroundColor: theme.background }]}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four },
        ]}>
        <View style={styles.container}>
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>{t('profile')}</ThemedText>

            <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
              <View style={styles.avatarRow}>
                <Pressable disabled={avatarUploading} onPress={handleChangeAvatar} style={styles.avatarTouchable}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatarImage} contentFit="cover" />
                  ) : (
                    <View style={[styles.avatarFallback, { backgroundColor: theme.backgroundSelected }]}>
                      <ThemedText style={styles.avatarFallbackText} themeColor="textSecondary">
                        {(fullName?.[0] ?? user?.email?.[0] ?? 'T').toUpperCase()}
                      </ThemedText>
                    </View>
                  )}
                  {avatarUploading && (
                    <View style={styles.avatarOverlay}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    </View>
                  )}
                </Pressable>
                <View style={styles.avatarCopy}>
                  <ThemedText style={styles.avatarTitle}>{t('profilePictureLabel')}</ThemedText>
                  <Pressable disabled={avatarUploading} onPress={handleChangeAvatar}>
                    <ThemedText style={styles.avatarAction}>
                      {avatarUploading ? t('uploadingLabel') : t('changePicture')}
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
              {avatarError && <ThemedText style={styles.errorText}>{avatarError}</ThemedText>}

              <View style={styles.nameRow}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {t('displayNameLabel')}
                </ThemedText>
                <View style={styles.nameInputRow}>
                  <TextInput
                    maxLength={MAX_DISPLAY_NAME_LENGTH}
                    onChangeText={(text) => {
                      setFullName(text.replace(/[^\p{L}\s]/gu, ''));
                      setNameSaved(false);
                    }}
                    placeholder={t('namePlaceholder')}
                    placeholderTextColor={theme.textSecondary}
                    style={[
                      styles.input,
                      styles.nameInput,
                      { backgroundColor: theme.background, borderColor: theme.backgroundSelected, color: theme.text },
                    ]}
                    value={fullName}
                  />
                  <Pressable
                    disabled={nameSaving || !fullName.trim()}
                    onPress={handleSaveName}
                    style={[styles.saveButton, { opacity: nameSaving || !fullName.trim() ? 0.55 : 1 }]}>
                    <ThemedText style={styles.saveButtonText}>
                      {nameSaving ? t('savingLabel') : nameSaved ? t('savedLabel') : t('saveNameButton')}
                    </ThemedText>
                  </Pressable>
                </View>
                {nameError && <ThemedText style={styles.errorText}>{nameError}</ThemedText>}
              </View>

              <View style={styles.nameRow}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {t('phoneNumberLabel')}
                </ThemedText>
                <View style={styles.nameInputRow}>
                  <TextInput
                    keyboardType="phone-pad"
                    onChangeText={(text) => {
                      setPhoneNumber(text.replace(/[^\d\s+-]/g, ''));
                      setPhoneSaved(false);
                    }}
                    placeholder={t('phoneNumberPlaceholder')}
                    placeholderTextColor={theme.textSecondary}
                    style={[
                      styles.input,
                      styles.nameInput,
                      { backgroundColor: theme.background, borderColor: theme.backgroundSelected, color: theme.text },
                    ]}
                    value={phoneNumber}
                  />
                  <Pressable
                    disabled={phoneSaving}
                    onPress={handleSavePhone}
                    style={[styles.saveButton, { opacity: phoneSaving ? 0.55 : 1 }]}>
                    <ThemedText style={styles.saveButtonText}>
                      {phoneSaving ? t('savingLabel') : phoneSaved ? t('savedLabel') : t('saveNameButton')}
                    </ThemedText>
                  </Pressable>
                </View>
                {phoneError && <ThemedText style={styles.errorText}>{phoneError}</ThemedText>}
              </View>

              <View style={styles.nameRow}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {t('swishNumberLabel')}
                </ThemedText>
                <View style={styles.nameInputRow}>
                  <TextInput
                    onChangeText={(text) => {
                      setSwishNumber(text.replace(/[^\d\s+-]/g, ''));
                      setSwishSaved(false);
                    }}
                    placeholder={t('swishNumberPlaceholder')}
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="phone-pad"
                    style={[
                      styles.input,
                      styles.nameInput,
                      { backgroundColor: theme.background, borderColor: theme.backgroundSelected, color: theme.text },
                    ]}
                    value={swishNumber}
                  />
                  <Pressable
                    disabled={swishSaving}
                    onPress={handleSaveSwish}
                    style={[styles.saveButton, { opacity: swishSaving ? 0.55 : 1 }]}>
                    <ThemedText style={styles.saveButtonText}>
                      {swishSaving ? t('savingLabel') : swishSaved ? t('savedLabel') : t('saveNameButton')}
                    </ThemedText>
                  </Pressable>
                  {swishNumber.trim().length > 0 && (
                    <Pressable
                      disabled={swishDeleting}
                      onPress={handleDeleteSwish}
                      style={[styles.deleteSwishButton, swishDeleting && styles.buttonDisabled]}>
                      {swishDeleting ? (
                        <ActivityIndicator size="small" color="#C84646" />
                      ) : (
                        <ThemedText style={styles.deleteSwishButtonText}>✕</ThemedText>
                      )}
                    </Pressable>
                  )}
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('swishNumberHint')}
                </ThemedText>
                {swishError && <ThemedText style={styles.errorText}>{swishError}</ThemedText>}
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>{t('notificationsSection')}</ThemedText>

            <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
              <View style={styles.switchRow}>
                <View style={styles.switchCopy}>
                  <ThemedText style={styles.switchTitle}>{t('pushNotifTitle')}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('pushNotifCopy')}
                  </ThemedText>
                </View>
                {pushLoading ? (
                  <ActivityIndicator size="small" color={theme.textSecondary} />
                ) : (
                  <Switch
                    disabled={pushSubmitting}
                    onValueChange={handleTogglePush}
                    ios_backgroundColor="#B7BEC9"
                    thumbColor="#FFFFFF"
                    trackColor={{ false: '#B7BEC9', true: '#4F6FB7' }}
                    value={pushEnabled}
                  />
                )}
              </View>
              {pushError && <ThemedText style={styles.errorText}>{pushError}</ThemedText>}
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>{t('appearanceSection')}</ThemedText>

            <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
              <View style={styles.settingRow}>
                <ThemedText style={styles.switchTitle}>{t('languageLabel')}</ThemedText>
                <SegmentedControl
                  options={[
                    { id: 'sv', label: 'Svenska' },
                    { id: 'en', label: 'English' },
                  ]}
                  value={language}
                  onChange={(id) => setLanguage(id as Language)}
                />
              </View>

              <View style={styles.settingRow}>
                <ThemedText style={styles.switchTitle}>{t('themeLabel')}</ThemedText>
                <SegmentedControl
                  options={[
                    { id: 'light', label: t('themeLight') },
                    { id: 'dark', label: t('themeDark') },
                  ]}
                  value={themeMode}
                  onChange={(id) => setThemeMode(id as ThemeMode)}
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>{t('legalSection')}</ThemedText>

            <View style={[styles.card, styles.legalCard, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
              <LegalLink label={t('privacyPolicy')} onPress={() => router.push('./privacy')} />
              <View style={[styles.legalDivider, { backgroundColor: theme.backgroundSelected }]} />
              <LegalLink label={t('termsOfUse')} onPress={() => router.push('./terms')} />
              <View style={[styles.legalDivider, { backgroundColor: theme.backgroundSelected }]} />
              <LegalLink label={t('support')} onPress={() => router.push('./support')} />
              {isAdmin && (
                <>
                  <View style={[styles.legalDivider, { backgroundColor: theme.backgroundSelected }]} />
                  <LegalLink label="Admin" onPress={() => router.push('./admin')} />
                </>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>{t('securitySection')}</ThemedText>

            <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
              <View style={styles.nameRow}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {t('newPasswordLabel')}
                </ThemedText>
                <View style={styles.nameInputRow}>
                  <TextInput
                    autoCapitalize="none"
                    onChangeText={(text) => {
                      setNewPassword(text);
                      setPasswordSaved(false);
                    }}
                    placeholder={t('newPasswordPlaceholder')}
                    placeholderTextColor={theme.textSecondary}
                    secureTextEntry
                    style={[
                      styles.input,
                      styles.nameInput,
                      { backgroundColor: theme.background, borderColor: theme.backgroundSelected, color: theme.text },
                    ]}
                    value={newPassword}
                  />
                  <Pressable
                    disabled={passwordSaving || newPassword.length < 6}
                    onPress={handleChangePassword}
                    style={[styles.saveButton, { opacity: passwordSaving || newPassword.length < 6 ? 0.55 : 1 }]}>
                    <ThemedText style={styles.saveButtonText}>
                      {passwordSaving ? t('savingLabel') : passwordSaved ? t('savedLabel') : t('saveNameButton')}
                    </ThemedText>
                  </Pressable>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('newPasswordHint')}
                </ThemedText>
                {passwordError && <ThemedText style={styles.errorText}>{passwordError}</ThemedText>}
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>{t('accountSection')}</ThemedText>

            <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('deleteAccountDescription')}
              </ThemedText>
              <Pressable
                disabled={deletingAccount}
                onPress={handleDeleteAccount}
                style={[styles.deleteAccountButton, deletingAccount && styles.buttonDisabled]}>
                <ThemedText style={styles.deleteAccountButtonText}>
                  {deletingAccount ? t('deletingAccount') : t('deleteAccountButton')}
                </ThemedText>
              </Pressable>
              {deleteAccountError && <ThemedText style={styles.errorText}>{deleteAccountError}</ThemedText>}
            </View>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function LegalLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={styles.legalRow}>
      <ThemedText style={styles.switchTitle}>{label}</ThemedText>
      <ThemedText style={styles.legalChevron} themeColor="textSecondary">
        ›
      </ThemedText>
    </Pressable>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.segment, { backgroundColor: theme.backgroundSelected }]}>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            style={[styles.segmentButton, active && { backgroundColor: theme.backgroundElement }]}>
            <ThemedText
              style={styles.segmentText}
              themeColor={active ? 'text' : 'textSecondary'}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  avatarToast: {
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: 1,
    elevation: 4,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    position: 'absolute',
    shadowColor: '#1D2430',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    zIndex: 10,
  },
  avatarToastText: {
    fontSize: 14,
    fontWeight: '800',
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerInner: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
  },
  backButton: {
    alignItems: 'center',
    borderRadius: 8,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  backButtonText: {
    fontSize: 30,
    fontWeight: '500',
    lineHeight: 30,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
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
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  card: {
    borderRadius: 8,
    borderWidth: 1,
    gap: Spacing.three,
    padding: Spacing.three,
  },
  legalCard: {
    gap: 0,
    paddingVertical: Spacing.one,
  },
  legalRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: Spacing.two,
  },
  legalDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: Spacing.two,
  },
  legalChevron: {
    fontSize: 25,
    lineHeight: 28,
  },
  avatarRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.three,
  },
  avatarTouchable: {
    borderRadius: 32,
    height: 64,
    overflow: 'hidden',
    width: 64,
  },
  avatarImage: {
    height: 64,
    width: 64,
  },
  avatarFallback: {
    alignItems: 'center',
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  avatarFallbackText: {
    fontSize: 26,
    fontWeight: '800',
  },
  avatarOverlay: {
    alignItems: 'center',
    backgroundColor: '#1D243080',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  avatarCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  avatarTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  avatarAction: {
    color: '#4F6FB7',
    fontSize: 13,
    fontWeight: '800',
  },
  nameRow: {
    gap: Spacing.two,
  },
  nameInputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 46,
    paddingHorizontal: Spacing.three,
  },
  nameInput: {
    flex: 1,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#1D2430',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: Spacing.two,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  deleteSwishButton: {
    alignItems: 'center',
    borderColor: '#C84646',
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  deleteSwishButtonText: {
    color: '#C84646',
    fontSize: 15,
    fontWeight: '800',
  },
  deleteAccountButton: {
    alignItems: 'center',
    borderColor: '#C84646',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: Spacing.three,
  },
  deleteAccountButtonText: {
    color: '#C84646',
    fontSize: 14,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.three,
  },
  switchCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  switchTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: {
    color: '#C84646',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  settingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  segment: {
    borderRadius: 10,
    flexDirection: 'row',
    padding: 3,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 7,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: Spacing.two,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

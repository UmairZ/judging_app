import { useState } from 'react';
import { updateProfile, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase/app';
import { useAuth } from '../auth/AuthContext';
import { Badge } from './vendor/badge';
import { Button } from './vendor/button';
import { Field, Fieldset, Label } from './vendor/fieldset';
import { Heading } from './vendor/heading';
import { Input } from './vendor/input';
import { Text } from './vendor/text';

export function AccountPage() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [displayNameBusy, setDisplayNameBusy] = useState(false);
  const [displayNameSaved, setDisplayNameSaved] = useState(false);
  const [displayNameError, setDisplayNameError] = useState('');

  const [emailVerificationBusy, setEmailVerificationBusy] = useState(false);
  const [emailVerificationError, setEmailVerificationError] = useState('');
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);

  const [passwordResetBusy, setPasswordResetBusy] = useState(false);
  const [passwordResetError, setPasswordResetError] = useState('');
  const [passwordResetSent, setPasswordResetSent] = useState(false);

  const handleDisplayNameSave = async () => {
    setDisplayNameBusy(true);
    setDisplayNameError('');
    setDisplayNameSaved(false);
    try {
      await updateProfile(auth.currentUser!, { displayName });
      setDisplayNameSaved(true);
      setTimeout(() => setDisplayNameSaved(false), 3000);
    } catch (err) {
      setDisplayNameError((err as { message?: string })?.message ?? 'Could not update display name.');
    } finally {
      setDisplayNameBusy(false);
    }
  };

  const handleResendVerification = async () => {
    setEmailVerificationBusy(true);
    setEmailVerificationError('');
    setEmailVerificationSent(false);
    try {
      await sendEmailVerification(auth.currentUser!);
      setEmailVerificationSent(true);
      setTimeout(() => setEmailVerificationSent(false), 3000);
    } catch (err) {
      setEmailVerificationError((err as { message?: string })?.message ?? 'Could not send verification email.');
    } finally {
      setEmailVerificationBusy(false);
    }
  };

  const handleSendPasswordReset = async () => {
    setPasswordResetBusy(true);
    setPasswordResetError('');
    setPasswordResetSent(false);
    try {
      await sendPasswordResetEmail(auth, user!.email!);
      setPasswordResetSent(true);
      setTimeout(() => setPasswordResetSent(false), 3000);
    } catch (err) {
      setPasswordResetError((err as { message?: string })?.message ?? 'Could not send password reset email.');
    } finally {
      setPasswordResetBusy(false);
    }
  };

  return (
    <>
      <Heading>Account</Heading>

      <Fieldset className="mt-8">
        <Field>
          <Label>Display name</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </Field>

        <div className="mt-8">
          <Button onClick={() => void handleDisplayNameSave()} disabled={displayNameBusy}>
            {displayNameBusy ? 'Saving…' : 'Save'}
          </Button>
        </div>

        {displayNameError && (
          <Text className="mt-3 text-red-600 dark:text-red-500">{displayNameError}</Text>
        )}
        {displayNameSaved && <Text className="mt-3 text-green-600 dark:text-green-500">Saved!</Text>}
      </Fieldset>

      <Fieldset className="mt-12">
        <Field>
          <Label>Email</Label>
          <div className="mt-3 flex items-center gap-3">
            <div className="text-base/6 text-zinc-950 sm:text-sm/6 dark:text-white">{user?.email}</div>
            <Badge color={user?.emailVerified ? 'lime' : 'amber'}>
              {user?.emailVerified ? 'Verified' : 'Not verified'}
            </Badge>
          </div>
          {!user?.emailVerified && (
            <div className="mt-3">
              <Button plain onClick={() => void handleResendVerification()} disabled={emailVerificationBusy}>
                {emailVerificationBusy ? 'Sending…' : 'Resend'}
              </Button>
            </div>
          )}
          {emailVerificationError && (
            <Text className="mt-3 text-red-600 dark:text-red-500">{emailVerificationError}</Text>
          )}
          {emailVerificationSent && (
            <Text className="mt-3 text-green-600 dark:text-green-500">Verification email sent!</Text>
          )}
        </Field>

        <Field className="mt-8">
          <Button outline onClick={() => void handleSendPasswordReset()} disabled={passwordResetBusy}>
            {passwordResetBusy ? 'Sending…' : 'Send password reset email'}
          </Button>
          {passwordResetError && (
            <Text className="mt-3 text-red-600 dark:text-red-500">{passwordResetError}</Text>
          )}
          {passwordResetSent && (
            <Text className="mt-3 text-green-600 dark:text-green-500">Password reset email sent!</Text>
          )}
        </Field>
      </Fieldset>
    </>
  );
}

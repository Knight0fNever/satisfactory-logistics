import { Button, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconMail } from '@tabler/icons-react';
import { type FormEvent, useState } from 'react';
import { supabaseClient } from '@/core/supabase';

export function EmailMagicLinkForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email) return;
    try {
      setLoading(true);
      const { error } = await supabaseClient.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setSent(true);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to send magic link',
        color: 'red',
      });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <Text size="sm" c="dimmed" ta="center">
        Check your inbox at <strong>{email}</strong> for a sign-in link.
      </Text>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="xs">
        <TextInput
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.currentTarget.value)}
          required
          leftSection={<IconMail size={16} />}
        />
        <Button
          type="submit"
          variant="default"
          loading={loading}
          leftSection={<IconMail size={18} />}
        >
          Send magic link
        </Button>
      </Stack>
    </form>
  );
}

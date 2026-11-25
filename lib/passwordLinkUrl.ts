// Construeix l'enllaç complet per crear o canviar la contrasenya d'un usuari.
import { getPasswordStamp } from './users';
import { appUrl } from './emails';
import { createPasswordToken, type PasswordLinkPurpose } from './passwordLink';

export async function passwordLinkFor(userId: string, purpose: PasswordLinkPurpose): Promise<string | null> {
  const stamp = await getPasswordStamp(userId);
  if (!stamp) return null;
  return `${appUrl()}/contrasenya?t=${encodeURIComponent(createPasswordToken(userId, stamp, purpose))}`;
}

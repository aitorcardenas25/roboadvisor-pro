// Missatges que el servidor d'autenticació retorna al formulari d'entrada.
// (Fitxer sense dependències de servidor perquè el puguin importar les pàgines.)
export const TWO_FACTOR_REQUIRED = '2FA_REQUIRED';
export const TWO_FACTOR_WRONG    = 'Codi de verificació incorrecte. Mira l\'app del mòbil i torna-ho a provar.';
export const TOO_MANY_ATTEMPTS   = 'Massa intents. Espera 15 minuts i torna-ho a provar.';

/** Text per a l'usuari a partir de l'error de signIn(). */
export function loginErrorText(error: string): string {
  if (error === TWO_FACTOR_WRONG || error === TOO_MANY_ATTEMPTS) return error;
  return 'Usuari o contrasenya incorrectes. Torna-ho a intentar.';
}

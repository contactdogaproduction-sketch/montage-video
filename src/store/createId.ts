/**
 * Identifiant unique. `crypto.randomUUID` n'existe qu'en contexte sécurisé (https, localhost) :
 * repli sur `getRandomValues` pour un test sur téléphone via l'adresse IP du PC en http.
 */
export function createId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

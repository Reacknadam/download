/**
 * Configuration de la tarification des vidéos
 * Basée sur: 0.05$ par minute, minimum 0.50$ par vidéo
 */

export const PRICE_PER_MINUTE = 0.05; // 5 cents par minute
export const MIN_PRICE_PER_VIDEO = 0.50; // 50 cents minimum par vidéo
export const TEACHER_SHARE = 0.80; // 80% pour le formateur
export const PLATFORM_FEE = 0.20; // 20% pour la plateforme

/**
 * Calcule le prix d'une vidéo selon sa durée
 * @param durationInSeconds Durée de la vidéo en secondes
 * @returns Prix en dollars
 */
export function calculateVideoPrice(durationInSeconds: number): number {
  const minutes = Math.ceil(durationInSeconds / 60);
  const calculatedPrice = minutes * PRICE_PER_MINUTE;
  return Math.max(calculatedPrice, MIN_PRICE_PER_VIDEO);
}

/**
 * Calcule le prix total pour une série de vidéos
 * @param totalDurationInSeconds Durée totale en secondes
 * @returns Prix en dollars
 */
export function calculateSeriesPrice(totalDurationInSeconds: number): number {
  return calculateVideoPrice(totalDurationInSeconds);
}

/**
 * Calcule la part du formateur et de la plateforme
 * @param totalPrice Prix total
 * @returns Objet avec les parts de chacun
 */
export function calculateRevenueShare(totalPrice: number) {
  return {
    teacherShare: totalPrice * TEACHER_SHARE,
    platformFee: totalPrice * PLATFORM_FEE,
  };
}

/**
 * Formate le prix en cents pour le stockage (ex: 9999 = $99.99)
 * @param priceInDollars Prix en dollars
 * @returns Prix en cents
 */
export function priceToCents(priceInDollars: number): number {
  return Math.round(priceInDollars * 100);
}

/**
 * Convertit le prix de cents en dollars
 * @param priceInCents Prix en cents
 * @returns Prix en dollars
 */
export function centsToPrice(priceInCents: number): number {
  return priceInCents / 100;
}

/**
 * Formate le prix pour l'affichage
 * @param price Prix en dollars
 * @param currency Devise (default: 'USD')
 * @returns Chaîne formatée
 */
export function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(price);
}

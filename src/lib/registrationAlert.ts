/**
 * Helper za odredivanje inboxa koji prima vendor/OWNER alert o novim
 * registracijskim zahtjevima. Dijele ga register API i resend-alert API.
 *
 * Redoslijed prioriteta:
 *   1) VENDOR_ALERT_EMAIL                         (preporuceno)
 *   2) PLATFORM_REGISTRATION_ALERT_EMAIL          (alias)
 *   3) VENDOR_FROM_EMAIL                          (fallback - obicno isti)
 */

export function resolveVendorAlertInbox(): string | null {
  return (
    process.env.VENDOR_ALERT_EMAIL?.trim() ||
    process.env.PLATFORM_REGISTRATION_ALERT_EMAIL?.trim() ||
    process.env.VENDOR_FROM_EMAIL?.trim() ||
    null
  );
}

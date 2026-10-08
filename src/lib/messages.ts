import type { FormEvent } from 'react';

export function clearFieldValidation(event: FormEvent<HTMLFormElement>) {
  const field = event.target;
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)
    field.setCustomValidity('');
}

export function translateFieldValidation(event: FormEvent<HTMLFormElement>) {
  const field = event.target;
  if (!(
    field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement
  ))
    return;
  field.setCustomValidity('');
  if (field.validity.valueMissing)
    field.setCustomValidity('Palun täida see väli.');
  else if (field.validity.typeMismatch)
    field.setCustomValidity(
      field.type === 'email'
        ? 'Sisesta kehtiv e-posti aadress.'
        : 'Sisesta täielik veebiaadress, mis algab http:// või https://.',
    );
  else if (!field.validity.valid)
    field.setCustomValidity('Palun kontrolli sisestatud väärtust.');
}

const validationMessages: Record<string, string> = {
  'Choose CFP or Event.': 'Vali Call for Papers (CFP) või sündmus.',
  'A title is required.': 'Pealkiri on kohustuslik.',
  'Title must be 500 characters or fewer.':
    'Pealkiri võib olla kuni 500 tähemärki pikk.',
  'Choose a valid event mode.': 'Vali sobiv osalemisviis.',
  'Enter valid calendar dates.': 'Sisesta kehtivad kuupäevad.',
  'Enter an event start date before an end date.':
    'Sisesta enne lõppkuupäeva ka alguskuupäev.',
  'Event end cannot precede event start.':
    'Sündmuse lõpp ei saa olla enne algust.',
  'Use a separate CFP for a submission deadline.':
    'Esitamise tähtaja jaoks lisa eraldi Call for Papers (CFP).',
  'Use a separate Event for event dates.':
    'Toimumiskuupäevade jaoks lisa eraldi sündmus.',
  'Announcement URL must be a valid HTTP or HTTPS address.':
    'Kuulutuse link peab olema kehtiv HTTP- või HTTPS-aadress.',
  'Topics must be short text keywords.':
    'Teemad peavad olema lühikesed märksõnad.',
};

const errorCodes: Record<string, string> = {
  '23505': 'Sama pealkirja, väljaandja ja kuupäevaga kuulutus on juba olemas.',
  '42501': 'Sul puudub selleks toiminguks õigus. Palun logi uuesti sisse.',
  PGRST301: 'Sisselogimine on aegunud. Palun logi uuesti sisse.',
  PGRST116: 'Kuulutust ei leitud. Värskenda lehte ja proovi uuesti.',
  otp_expired: 'Sisselogimislink on aegunud. Küsi uus link.',
  signup_disabled: 'Sisse saavad logida ainult kutse saanud haldurid.',
  user_not_found: 'Sisse saavad logida ainult kutse saanud haldurid.',
  over_email_send_rate_limit:
    'Liiga palju sisselogimiskatseid. Oota veidi ja proovi uuesti.',
  over_request_rate_limit:
    'Liiga palju päringuid. Oota veidi ja proovi uuesti.',
};

const localMessages = new Set([
  ...Object.values(validationMessages),
  ...Object.values(errorCodes),
  'Palun logi uuesti sisse.',
  'Kuulutuse salvestamine ebaõnnestus.',
]);

// Service errors are UI messages, not announcement content. Never display
// untranslated backend text (which may also contain implementation details).
export function errorText(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback;
  const { code, message } = error as { code?: string; message?: string };
  if (code && errorCodes[code]) return errorCodes[code];
  if (message && validationMessages[message])
    return validationMessages[message];
  if (message && localMessages.has(message)) return message;
  return fallback;
}

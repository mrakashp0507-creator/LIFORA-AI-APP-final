import { Language, VaultState } from '../types';

export interface AiResponse {
  query: string;
  detectedLanguage: Language;
  replyText: string;
  actionRoute?: 'FINANCE' | 'VAULT' | 'PROFILE' | 'HOME';
}

export const speakMessage = (text: string, language: Language = 'en'): Promise<void> => {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve();
      return;
    }
    window.speechSynthesis.cancel();
    const clean = text.replace(/[*_#`~]/g, '');
    const utterance = new SpeechSynthesisUtterance(clean);

    const voices = window.speechSynthesis.getVoices();
    if (language === 'ta') {
      const tamilVoice = voices.find((v) => v.lang.startsWith('ta'));
      if (tamilVoice) utterance.voice = tamilVoice;
      utterance.lang = 'ta-IN';
    } else {
      const indianVoice = voices.find((v) => v.lang === 'en-IN') || voices.find((v) => v.lang.startsWith('en'));
      if (indianVoice) utterance.voice = indianVoice;
      utterance.lang = 'en-IN';
    }

    utterance.rate = 1.0;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
};

export const speakText = speakMessage;

export const stopSpeech = () => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
};

/**
 * Strict anti-hallucination query processor.
 * Queries ONLY existing stored records entered by the user.
 * If zero records exist, strictly returns:
 * "I don't have that information in your LIFORA profile."
 */
export const queryTalkToLifora = (query: string, state: VaultState, prefLang: Language = 'en'): AiResponse => {
  const q = query.toLowerCase().trim();

  // Safe arrays
  const loans = state?.loans || [];
  const emis = state?.emis || [];
  const properties = state?.properties || [];
  const vehicles = state?.vehicles || [];
  const documents = state?.documents || [];
  const nominees = state?.nominees || [];
  const valuableAssets = state?.valuableAssets || [];

  // Detect language
  let detected: Language = prefLang;
  const isTamilScript = /[\u0B80-\u0BFF]/.test(query);
  const isTanglish = /\b(enakku|ethana|irukku|eppo|kadan|panam|vandi|sollu|paththi|ketturuken|illaya|enga)\b/i.test(query);

  if (isTamilScript) {
    detected = 'ta';
  } else if (isTanglish) {
    detected = 'tanglish';
  }

  // 1. LOAN QUERY
  if (q.includes('loan') || q.includes('kadan') || q.includes('கடன்') || q.includes('கடன்கள்')) {
    if (loans.length === 0) {
      const reply =
        detected === 'ta'
          ? 'உங்கள் LIFORA சுயவிவரத்தில் எந்தக் கடனும் பதிவு செய்யப்படவில்லை.'
          : detected === 'tanglish'
          ? 'Ungal LIFORA profile-la endha loan-um add aagala.'
          : "I don't have that information in your LIFORA profile. No loans have been added.";
      return { query, detectedLanguage: detected, replyText: reply, actionRoute: 'FINANCE' };
    }

    const first = loans[0];
    const reply =
      detected === 'ta'
        ? `உங்களிடம் ${loans.length} பதிவு செய்யப்பட்ட கடன்கள் உள்ளன. முதன்மை கடன்: ${first?.provider || 'Loan'} (நிலுவைத் தொகை: ₹${(first?.outstanding_amount || 0).toLocaleString('en-IN')}).`
        : detected === 'tanglish'
        ? `Ungalukku ${loans.length} loans record aagi irukku. First loan: ${first?.provider || 'Loan'}, Outstanding ₹${(first?.outstanding_amount || 0).toLocaleString('en-IN')}.`
        : `You have ${loans.length} active loans. Primary: ${first?.provider || 'Loan'} with ₹${(first?.outstanding_amount || 0).toLocaleString('en-IN')} outstanding.`;
    return { query, detectedLanguage: detected, replyText: reply, actionRoute: 'FINANCE' };
  }

  // 2. EMI / NEXT PAYMENT
  if (q.includes('emi') || q.includes('due') || q.includes('தவணை') || q.includes('payment')) {
    if (emis.length === 0 && loans.length === 0) {
      const reply =
        detected === 'ta'
          ? 'உங்கள் LIFORA சுயவிவரத்தில் வரவிருக்கும் EMI விவரங்கள் எதுவும் இல்லை.'
          : detected === 'tanglish'
          ? 'Ungal profile-la upcoming EMI details ethuvum illa.'
          : "I don't have that information in your LIFORA profile. No upcoming EMIs have been entered.";
      return { query, detectedLanguage: detected, replyText: reply, actionRoute: 'FINANCE' };
    }

    if (emis.length > 0) {
      const emi = emis[0];
      const reply =
        detected === 'ta'
          ? `உங்கள் அடுத்த EMI: ${emi?.name || 'EMI'} ₹${(emi?.amount || 0).toLocaleString('en-IN')}, செலுத்த வேண்டிய தேதி: ${emi?.due_date || 'Due date'}.`
          : detected === 'tanglish'
          ? `Ungal next EMI: ${emi?.name || 'EMI'} ₹${(emi?.amount || 0).toLocaleString('en-IN')}, due date: ${emi?.due_date || 'Due date'}.`
          : `Your next EMI is ${emi?.name || 'EMI'} of ₹${(emi?.amount || 0).toLocaleString('en-IN')} due on ${emi?.due_date || 'due date'}.`;
      return { query, detectedLanguage: detected, replyText: reply, actionRoute: 'FINANCE' };
    }

    const l = loans[0];
    const reply = `Your loan EMI for ${l?.provider || 'Loan'} is ₹${(l?.emi_amount || 0).toLocaleString('en-IN')} due on ${l?.due_date || 'due date'}.`;
    return { query, detectedLanguage: detected, replyText: reply, actionRoute: 'FINANCE' };
  }

  // 3. PROPERTY QUERY
  if (q.includes('property') || q.includes('house') || q.includes('land') || q.includes('சொத்து') || q.includes('வீடு')) {
    if (properties.length === 0) {
      const reply =
        detected === 'ta'
          ? 'உங்கள் LIFORA சுயவிவரத்தில் சொத்து விவரங்கள் எதுவும் இல்லை.'
          : detected === 'tanglish'
          ? 'Ungal profile-la property details ethuvum record aagala.'
          : "I don't have that information in your LIFORA profile. No property records have been added.";
      return { query, detectedLanguage: detected, replyText: reply, actionRoute: 'VAULT' };
    }

    const p = properties[0];
    const reply =
      detected === 'ta'
        ? `உங்களிடம் ${properties.length} சொத்துக்கள் பதிவு செய்யப்பட்டுள்ளன: ${p?.name || 'Property'} (${p?.location || ''}), உத்தேச மதிப்பு: ₹${(p?.estimated_value || 0).toLocaleString('en-IN')}.`
        : detected === 'tanglish'
        ? `Ungalukku ${properties.length} properties irukku: ${p?.name || 'Property'} at ${p?.location || ''}, estimated value ₹${(p?.estimated_value || 0).toLocaleString('en-IN')}.`
        : `You have ${properties.length} properties registered: ${p?.name || 'Property'} in ${p?.location || ''} (Estimated: ₹${(p?.estimated_value || 0).toLocaleString('en-IN')}).`;
    return { query, detectedLanguage: detected, replyText: reply, actionRoute: 'VAULT' };
  }

  // 4. VEHICLES QUERY
  if (q.includes('vehicle') || q.includes('car') || q.includes('bike') || q.includes('வாகனம்') || q.includes('வண்டி')) {
    if (vehicles.length === 0) {
      const reply =
        detected === 'ta'
          ? 'உங்கள் பெட்டகத்தில் வாகனங்கள் எதுவும் பதிவு செய்யப்படவில்லை.'
          : detected === 'tanglish'
          ? 'Ungal vault-la vehicles ethuvum add aagala.'
          : "I don't have that information in your LIFORA profile. No vehicles have been added.";
      return { query, detectedLanguage: detected, replyText: reply, actionRoute: 'VAULT' };
    }

    const v = vehicles[0];
    const reply =
      detected === 'ta'
        ? `உங்களிடம் ${vehicles.length} வாகனங்கள் உள்ளன: ${v?.brand || ''} ${v?.model || ''} (எண்: ${v?.registration_number || ''}).`
        : detected === 'tanglish'
        ? `Ungalukku ${vehicles.length} vehicles irukku: ${v?.brand || ''} ${v?.model || ''}, No: ${v?.registration_number || ''}.`
        : `You have ${vehicles.length} vehicles recorded: ${v?.brand || ''} ${v?.model || ''} (${v?.registration_number || ''}).`;
    return { query, detectedLanguage: detected, replyText: reply, actionRoute: 'VAULT' };
  }

  // 5. DOCUMENTS QUERY
  if (q.includes('document') || q.includes('file') || q.includes('ஆவணம்') || q.includes('docs')) {
    if (documents.length === 0) {
      const reply =
        detected === 'ta'
          ? 'உங்கள் பெட்டகத்தில் ஆவணங்கள் எதுவும் பதிவேற்றப்படவில்லை.'
          : detected === 'tanglish'
          ? 'Ungal vault-la documents ethuvum upload aagala.'
          : "I don't have that information in your LIFORA profile. No documents have been uploaded.";
      return { query, detectedLanguage: detected, replyText: reply, actionRoute: 'VAULT' };
    }

    const reply =
      detected === 'ta'
        ? `உங்கள் பாதுகாப்பான பெட்டகத்தில் ${documents.length} ஆவணங்கள் உள்ளன.`
        : detected === 'tanglish'
        ? `Ungal vault-la total ${documents.length} documents save aagi irukku.`
        : `You have ${documents.length} documents securely stored in your Document Vault.`;
    return { query, detectedLanguage: detected, replyText: reply, actionRoute: 'VAULT' };
  }

  // 6. NOMINEE QUERY
  if (q.includes('nominee') || q.includes('நியமனதாரர்') || q.includes('heir') || q.includes('family')) {
    if (nominees.length === 0) {
      const reply =
        detected === 'ta'
          ? 'உங்கள் LIFORA சுயவிவரத்தில் நியமனதாரர் யாரும் நியமிக்கப்படவில்லை.'
          : detected === 'tanglish'
          ? 'Ungal profile-la nominee yaarum add panna villai.'
          : "I don't have that information in your LIFORA profile. No nominee has been designated yet.";
      return { query, detectedLanguage: detected, replyText: reply, actionRoute: 'PROFILE' };
    }

    const nom = nominees[0];
    const reply =
      detected === 'ta'
        ? `உங்கள் நியமனதாரர்: ${nom?.name || 'Nominee'} (${nom?.relationship || ''}). நிலை: ${nom?.status === 'VERIFIED' ? 'சரிபார்க்கப்பட்டது' : 'சரிபார்ப்பு நிலுவையில் உள்ளது'}.`
        : detected === 'tanglish'
        ? `Ungal nominee: ${nom?.name || 'Nominee'} (${nom?.relationship || ''}). Status: ${nom?.status}.`
        : `Your designated nominee is ${nom?.name || 'Nominee'} (${nom?.relationship || ''}), currently ${nom?.status === 'VERIFIED' ? 'Verified' : 'Pending verification'}.`;
    return { query, detectedLanguage: detected, replyText: reply, actionRoute: 'PROFILE' };
  }

  // 7. VALUABLES QUERY
  if (q.includes('gold') || q.includes('jewelry') || q.includes('jewellery') || q.includes('தங்கம்') || q.includes('valuable')) {
    if (valuableAssets.length === 0) {
      const reply =
        detected === 'ta'
          ? 'உங்கள் பெட்டகத்தில் மதிப்புமிக்க பொருட்கள் எதுவும் பதிவு செய்யப்படவில்லை.'
          : detected === 'tanglish'
          ? 'Ungal vault-la valuables ethuvum record aagala.'
          : "I don't have that information in your LIFORA profile. No valuable assets have been added.";
      return { query, detectedLanguage: detected, replyText: reply, actionRoute: 'VAULT' };
    }

    const a = valuableAssets[0];
    const reply = `You have ${valuableAssets.length} valuable asset records: ${a?.name || 'Item'} (User-estimated at ₹${(a?.estimated_value || 0).toLocaleString('en-IN')}).`;
    return { query, detectedLanguage: detected, replyText: reply, actionRoute: 'VAULT' };
  }

  // STRICT ANTI-HALLUCINATION FALLBACK
  const fallback =
    detected === 'ta'
      ? 'மன்னிக்கவும், அந்த விவரங்கள் உங்கள் LIFORA சுயவிவரத்தில் இல்லை. கடன்கள், தவணைகள், சொத்துக்கள் அல்லது ஆவணங்கள் பற்றி நீங்கள் கேட்கலாம்.'
      : detected === 'tanglish'
      ? 'Sorry, antha information ungal LIFORA profile-la illa. Ungal loans, EMIs, properties, allathu documents paththi kekalaam.'
      : "I don't have that information in your LIFORA profile. You can ask about your loans, EMIs, properties, vehicles, documents, or nominee.";

  return {
    query,
    detectedLanguage: detected,
    replyText: fallback,
  };
};

export const processAiQuery = queryTalkToLifora;

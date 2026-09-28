import React, { useState, useEffect } from 'react';
import { 
  Mic, 
  MicOff, 
  X, 
  Send, 
  Volume2, 
  ArrowRight,
  Shield
} from 'lucide-react';
import { VaultState, Language } from '../../types';
import { queryTalkToLifora, speakMessage, stopSpeech } from '../../services/aiService';

interface MobileVoiceAssistantProps {
  state: VaultState;
  currentLanguage: Language;
  onClose: () => void;
  onNavigate: (tab: string, subtab?: string) => void;
}

export const MobileVoiceAssistant: React.FC<MobileVoiceAssistantProps> = ({
  state,
  currentLanguage,
  onClose,
  onNavigate
}) => {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [conversation, setConversation] = useState<Array<{ role: 'USER' | 'ASSISTANT'; text: string; actionRoute?: string }>>([
    {
      role: 'ASSISTANT',
      text: currentLanguage === 'ta'
        ? 'வணக்கம்! உங்கள் லோன், இ.எம்.ஐ, இன்சூரன்ஸ் அல்லது ஆவணங்கள் பற்றி என்னிடம் கேட்கலாம்.'
        : currentLanguage === 'tanglish'
        ? 'Vanakkam! Unga loan, EMI, insurance or property paththi enkitta kelunga.'
        : 'Hello! You can ask me about your loans, EMIs, insurance, properties, or stored documents.',
    },
  ]);

  const recognitionRef = React.useRef<any>(null);

  useEffect(() => {
    return () => {
      stopSpeech();
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const handleSendQuery = async (queryText: string) => {
    if (!queryText.trim()) return;

    const userEntry = { role: 'USER' as const, text: queryText };
    setConversation((prev) => [...prev, userEntry]);
    setInputText('');

    const response = queryTalkToLifora(queryText, state, currentLanguage);

    const assistantEntry = {
      role: 'ASSISTANT' as const,
      text: response.replyText,
      actionRoute: response.actionRoute,
    };

    setConversation((prev) => [...prev, assistantEntry]);

    setIsSpeaking(true);
    await speakMessage(response.replyText, response.detectedLanguage);
    setIsSpeaking(false);
  };

  const toggleMic = () => {
    setVoiceError('');
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setVoiceError('Voice speech recognition is not available in this browser. Please type your query below.');
      return;
    }

    try {
      const rec = new SpeechRec();
      recognitionRef.current = rec;
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = currentLanguage === 'ta' ? 'ta-IN' : 'en-IN';

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setIsListening(false);
        handleSendQuery(transcript);
      };

      rec.onerror = (e: any) => {
        setIsListening(false);
        console.warn('SpeechRec error:', e);
        setVoiceError('Microphone input was not detected or was dismissed. You can type below.');
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.start();
    } catch (e: any) {
      console.warn('SpeechRec failed:', e);
      setIsListening(false);
      setVoiceError('Could not start voice recognition. Please type your question below.');
    }
  };

  const suggestions = currentLanguage === 'ta'
    ? [
        'எனக்கு என்ன லோன் இருக்கு?',
        'என் இன்சூரன்ஸ் எப்போ முடியும்?',
        'என் சொத்து விவரங்கள் காட்டு',
        'நாமினி யாரு?'
      ]
    : currentLanguage === 'tanglish'
    ? [
        'Enakku ethana bank account irukku?',
        'Enoda monthly EMI evlo?',
        'Enna documents irukku?',
        'Nominee phone verify aaiducha?'
      ]
    : [
        'What is my total monthly EMI burden?',
        'Which insurance policies do I have?',
        'Show me my registered properties',
        'Who is my designated nominee?'
      ];

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-white border border-stone-200 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl flex flex-col max-h-[85vh] h-[560px]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-800 flex items-center justify-center">
              <Mic className="w-4 h-4 text-emerald-800" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">
                Voice Search & Assistant
              </h3>
              <p className="text-[10px] text-stone-500">Searches strictly inside your saved vault</p>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {voiceError && (
          <div className="my-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start justify-between gap-2">
            <span>{voiceError}</span>
            <button
              onClick={() => setVoiceError('')}
              className="text-amber-700 hover:text-amber-900 p-0.5 shrink-0"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Conversation Area */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 scrollbar-none">
          {conversation.map((msg, i) => (
            <div
              key={i}
              className={`flex flex-col ${msg.role === 'USER' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                  msg.role === 'USER'
                    ? 'bg-emerald-800 text-white font-medium rounded-br-xs'
                    : 'bg-stone-100 text-stone-900 rounded-bl-xs border border-stone-200/80 shadow-xs'
                }`}
              >
                {msg.text}
              </div>

              {msg.actionRoute && (
                <button
                  onClick={() => {
                    onClose();
                    if (msg.actionRoute === 'FINANCE') onNavigate('vault');
                    else if (msg.actionRoute === 'VAULT') onNavigate('assets');
                    else if (msg.actionRoute === 'PROFILE') onNavigate('profile');
                  }}
                  className="mt-1 text-[11px] font-semibold text-emerald-800 hover:underline flex items-center gap-1 self-start"
                >
                  <span>View in {msg.actionRoute}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}

          {isSpeaking && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-medium">
              <Volume2 className="w-3.5 h-3.5" />
              <span>Speaking response...</span>
            </div>
          )}
        </div>

        {/* Suggestion Chips */}
        <div className="py-2 overflow-x-auto flex gap-1.5 scrollbar-none">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSendQuery(s)}
              className="py-1 px-2.5 rounded-full bg-stone-100 hover:bg-stone-200 border border-stone-200 text-[10px] text-stone-700 font-medium whitespace-nowrap active:scale-95 transition-all"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="pt-2 border-t border-stone-200 flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSendQuery(inputText);
            }}
            placeholder={isListening ? 'Listening to voice...' : 'Ask about loans, EMIs, properties...'}
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-stone-300 focus:border-emerald-700 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none shadow-xs"
          />

          <button
            type="button"
            onClick={toggleMic}
            className={`p-2.5 rounded-xl transition-all shadow-xs active:scale-95 ${
              isListening
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
            title="Toggle Mic"
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => handleSendQuery(inputText)}
            className="p-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold active:scale-95 transition-all shadow-xs"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

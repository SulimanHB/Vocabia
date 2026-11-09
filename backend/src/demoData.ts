import type { WordInput } from './validation.js';

export interface DemoWord {
  term: string;
  translation: string;
  targetLanguage: WordInput['targetLanguage'];
  wordType: WordInput['wordType'];
  collections: string[];
  examples: [string, string][];
  englishVerbForms?: WordInput['englishVerbForms'];
}

// Datos ficticios de la demo. Cada pareja contiene texto en español y su traducción.
export const demoWords: DemoWord[] = [
  { term: 'dormir', translation: 'sleep', targetLanguage: 'en', wordType: 'verb', collections: ['A1'], englishVerbForms: { past: 'slept', pastParticiple: 'slept', ing: 'sleeping' }, examples: [['Necesito dormir.', 'I need to sleep.'], ['El bebé duerme.', 'The baby sleeps.']] },
  { term: 'beber', translation: 'drink', targetLanguage: 'en', wordType: 'verb', collections: ['A1'], englishVerbForms: { past: 'drank', pastParticiple: 'drunk', ing: 'drinking' }, examples: [['Quiero beber agua.', 'I want to drink water.'], ['Ella bebe té.', 'She drinks tea.']] },
  { term: 'comer', translation: 'eat', targetLanguage: 'en', wordType: 'verb', collections: ['A1'], englishVerbForms: { past: 'ate', pastParticiple: 'eaten', ing: 'eating' }, examples: [['Vamos a comer.', 'Let’s eat.'], ['Como una manzana.', 'I eat an apple.']] },
  { term: 'ir', translation: 'go', targetLanguage: 'en', wordType: 'verb', collections: ['A1', 'Viajes'], englishVerbForms: { past: 'went', pastParticiple: 'gone', ing: 'going' }, examples: [['Voy al parque.', 'I go to the park.'], ['Vamos a casa.', 'Let’s go home.']] },
  { term: 'escribir', translation: 'write', targetLanguage: 'en', wordType: 'verb', collections: ['A2'], englishVerbForms: { past: 'wrote', pastParticiple: 'written', ing: 'writing' }, examples: [['Escribo una carta.', 'I write a letter.'], ['Ella escribe cada día.', 'She writes every day.']] },
  { term: 'libro', translation: 'book', targetLanguage: 'en', wordType: 'noun', collections: ['A1'], examples: [['Leo un libro.', 'I read a book.'], ['Este libro es interesante.', 'This book is interesting.']] },
  { term: 'casa', translation: 'house', targetLanguage: 'en', wordType: 'noun', collections: ['A1'], examples: [['La casa es pequeña.', 'The house is small.'], ['Vivo en una casa azul.', 'I live in a blue house.']] },
  { term: 'agua', translation: 'water', targetLanguage: 'en', wordType: 'noun', collections: ['A1'], examples: [['Necesito agua.', 'I need water.'], ['El agua está fría.', 'The water is cold.']] },
  { term: 'amigo', translation: 'friend', targetLanguage: 'en', wordType: 'noun', collections: ['A1'], examples: [['Mi amigo vive aquí.', 'My friend lives here.'], ['Ella es una buena amiga.', 'She is a good friend.']] },
  { term: 'billete', translation: 'ticket', targetLanguage: 'en', wordType: 'noun', collections: ['A2', 'Viajes'], examples: [['Tengo un billete de tren.', 'I have a train ticket.'], ['¿Dónde compro un billete?', 'Where can I buy a ticket?']] },
  { term: 'cansado', translation: 'tired', targetLanguage: 'en', wordType: 'adjective', collections: ['A1'], examples: [['Estoy cansado hoy.', 'I am tired today.'], ['Después de correr, estoy cansado.', 'After running, I am tired.']] },
  { term: 'feliz', translation: 'happy', targetLanguage: 'en', wordType: 'adjective', collections: ['A1'], examples: [['Estoy feliz.', 'I am happy.'], ['Ella parece feliz.', 'She looks happy.']] },
  { term: 'rápido', translation: 'fast', targetLanguage: 'en', wordType: 'adjective', collections: ['A2'], examples: [['Ese tren es rápido.', 'That train is fast.'], ['Es un coche rápido.', 'It is a fast car.']] },
  { term: 'importante', translation: 'important', targetLanguage: 'en', wordType: 'adjective', collections: ['A2'], examples: [['Esta palabra es importante.', 'This word is important.'], ['Tengo una pregunta importante.', 'I have an important question.']] },
  { term: 'lentamente', translation: 'slowly', targetLanguage: 'en', wordType: 'adverb', collections: ['A2'], examples: [['Habla lentamente, por favor.', 'Speak slowly, please.'], ['El tren avanza lentamente.', 'The train moves slowly.']] },
  { term: 'siempre', translation: 'always', targetLanguage: 'en', wordType: 'adverb', collections: ['A1'], examples: [['Siempre desayuno temprano.', 'I always eat breakfast early.'], ['Ella siempre sonríe.', 'She always smiles.']] },
  { term: 'buenos días', translation: 'good morning', targetLanguage: 'en', wordType: 'expression', collections: ['A1'], examples: [['Buenos días, Ana.', 'Good morning, Ana.'], ['Le digo buenos días al profesor.', 'I say good morning to the teacher.']] },
  { term: 'por favor', translation: 'please', targetLanguage: 'en', wordType: 'expression', collections: ['A1', 'Viajes'], examples: [['Un café, por favor.', 'A coffee, please.'], ['Ayúdame, por favor.', 'Help me, please.']] },
  { term: '¿Dónde está la estación?', translation: 'Where is the station?', targetLanguage: 'en', wordType: 'expression', collections: ['A2', 'Viajes'], examples: [['Perdona, ¿dónde está la estación?', 'Excuse me, where is the station?'], ['¿Dónde está la estación de tren?', 'Where is the train station?']] },
  { term: 'hasta luego', translation: 'see you later', targetLanguage: 'en', wordType: 'expression', collections: ['A1'], examples: [['Hasta luego, nos vemos mañana.', 'See you later, see you tomorrow.'], ['Le dije hasta luego.', 'I said see you later.']] },

  { term: 'hola', translation: 'bonjour', targetLanguage: 'fr', wordType: 'expression', collections: ['A1'], examples: [['Hola, ¿cómo estás?', 'Bonjour, comment ça va ?'], ['Le dije hola.', 'Je lui ai dit bonjour.']] },
  { term: 'gracias', translation: 'merci', targetLanguage: 'fr', wordType: 'expression', collections: ['A1'], examples: [['Gracias por tu ayuda.', 'Merci pour ton aide.'], ['Muchas gracias.', 'Merci beaucoup.']] },
  { term: 'agua', translation: 'eau', targetLanguage: 'fr', wordType: 'noun', collections: ['A1'], examples: [['Quiero agua.', 'Je veux de l’eau.'], ['El agua está fría.', 'L’eau est froide.']] },
  { term: 'comer', translation: 'manger', targetLanguage: 'fr', wordType: 'verb', collections: ['A2'], examples: [['Quiero comer.', 'Je veux manger.'], ['Vamos a comer juntos.', 'Nous allons manger ensemble.']] },

  { term: 'hola', translation: 'hallo', targetLanguage: 'de', wordType: 'expression', collections: ['A1'], examples: [['Hola, ¿cómo estás?', 'Hallo, wie geht es dir?'], ['Le dije hola.', 'Ich habe Hallo gesagt.']] },
  { term: 'gracias', translation: 'danke', targetLanguage: 'de', wordType: 'expression', collections: ['A1'], examples: [['Gracias por tu ayuda.', 'Danke für deine Hilfe.'], ['Muchas gracias.', 'Vielen Dank.']] },
  { term: 'agua', translation: 'Wasser', targetLanguage: 'de', wordType: 'noun', collections: ['A1'], examples: [['Quiero agua.', 'Ich möchte Wasser.'], ['El agua está fría.', 'Das Wasser ist kalt.']] },
  { term: 'comer', translation: 'essen', targetLanguage: 'de', wordType: 'verb', collections: ['A2'], examples: [['Quiero comer.', 'Ich möchte essen.'], ['Comemos juntos.', 'Wir essen zusammen.']] },

  { term: 'hola', translation: 'ciao', targetLanguage: 'it', wordType: 'expression', collections: ['A1'], examples: [['Hola, ¿cómo estás?', 'Ciao, come stai?'], ['Le dije hola.', 'Gli ho detto ciao.']] },
  { term: 'gracias', translation: 'grazie', targetLanguage: 'it', wordType: 'expression', collections: ['A1'], examples: [['Gracias por tu ayuda.', 'Grazie per il tuo aiuto.'], ['Muchas gracias.', 'Grazie mille.']] },
  { term: 'agua', translation: 'acqua', targetLanguage: 'it', wordType: 'noun', collections: ['A1'], examples: [['Quiero agua.', 'Voglio dell’acqua.'], ['El agua está fría.', 'L’acqua è fredda.']] },
  { term: 'comer', translation: 'mangiare', targetLanguage: 'it', wordType: 'verb', collections: ['A2'], examples: [['Quiero comer.', 'Voglio mangiare.'], ['Comemos juntos.', 'Mangiamo insieme.']] },

  { term: 'hola', translation: 'olá', targetLanguage: 'pt', wordType: 'expression', collections: ['A1'], examples: [['Hola, ¿cómo estás?', 'Olá, como estás?'], ['Le dije hola.', 'Disse-lhe olá.']] },
  { term: 'gracias', translation: 'obrigado', targetLanguage: 'pt', wordType: 'expression', collections: ['A1'], examples: [['Gracias por tu ayuda.', 'Obrigado pela tua ajuda.'], ['Muchas gracias.', 'Muito obrigado.']] },
  { term: 'agua', translation: 'água', targetLanguage: 'pt', wordType: 'noun', collections: ['A1'], examples: [['Quiero agua.', 'Quero água.'], ['El agua está fría.', 'A água está fria.']] },
  { term: 'comer', translation: 'comer', targetLanguage: 'pt', wordType: 'verb', collections: ['A2'], examples: [['Quiero comer.', 'Quero comer.'], ['Comemos juntos.', 'Comemos juntos.']] },

  { term: 'hola', translation: 'こんにちは', targetLanguage: 'ja', wordType: 'expression', collections: ['A1'], examples: [['Hola, ¿cómo estás?', 'こんにちは、お元気ですか。'], ['Le dije hola.', 'こんにちはと言いました。']] },
  { term: 'gracias', translation: 'ありがとう', targetLanguage: 'ja', wordType: 'expression', collections: ['A1'], examples: [['Gracias por tu ayuda.', '手伝ってくれてありがとう。'], ['Muchas gracias.', 'どうもありがとう。']] },
  { term: 'agua', translation: '水', targetLanguage: 'ja', wordType: 'noun', collections: ['A1'], examples: [['Quiero agua.', '水が欲しいです。'], ['El agua está fría.', '水は冷たいです。']] },
  { term: 'comer', translation: '食べる', targetLanguage: 'ja', wordType: 'verb', collections: ['A2'], examples: [['Quiero comer.', '食べたいです。'], ['Comemos juntos.', '一緒に食べます。']] },
];

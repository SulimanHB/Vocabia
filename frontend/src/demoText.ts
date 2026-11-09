import type { WordInput } from './model';

export const demoText: Record<WordInput['sourceLanguage'], string> = {
  es: 'Demo pública · Usa datos de prueba. Tus cambios son temporales y solo aparecen en este navegador.',
  en: 'Public demo · Use sample data. Your changes are temporary and only appear in this browser.',
  fr: 'Démo publique · Utilisez des données de test. Vos modifications sont temporaires et visibles uniquement dans ce navigateur.',
  de: 'Öffentliche Demo · Verwende Testdaten. Deine Änderungen sind vorübergehend und nur in diesem Browser sichtbar.',
  it: 'Demo pubblica · Usa dati di prova. Le modifiche sono temporanee e visibili solo in questo browser.',
  pt: 'Demonstração pública · Usa dados de teste. As alterações são temporárias e aparecem apenas neste navegador.',
  ja: '公開デモ · テスト用のデータを使用してください。変更は一時的で、このブラウザーでのみ表示されます。',
};

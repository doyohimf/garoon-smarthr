import Kuroshiro from 'kuroshiro';
import KuromojiAnalyzer from 'kuroshiro-analyzer-kuromoji';

export class KuroshiroUtil {
  constructor() {
    this.kuroshiro = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    
    this.kuroshiro = new Kuroshiro.default();
    await this.kuroshiro.init(new KuromojiAnalyzer());
    this.initialized = true;
  }

  async kanjiToKatakana(kanji) {
    if (!kanji) return '';
    
    await this.init();
    return await this.kuroshiro.convert(kanji, { to: 'katakana' });
  }
}
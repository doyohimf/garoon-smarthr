export class KatakanaUtil {
  static ensureFullWidthKatakana(text) {
    if (!text) return '';

    const hiraganaToKatakana = {
      'あ': 'ア', 'い': 'イ', 'う': 'ウ', 'え': 'エ', 'お': 'オ',
      'か': 'カ', 'が': 'ガ', 'き': 'キ', 'ぎ': 'ギ', 'く': 'ク', 'ぐ': 'グ', 'け': 'ケ', 'げ': 'ゲ', 'こ': 'コ', 'ご': 'ゴ',
      'さ': 'サ', 'ざ': 'ザ', 'し': 'シ', 'じ': 'ジ', 'す': 'ス', 'ず': 'ズ', 'せ': 'セ', 'ぜ': 'ゼ', 'そ': 'ソ', 'ぞ': 'ゾ',
      'た': 'タ', 'だ': 'ダ', 'ち': 'チ', 'ぢ': 'ヂ', 'つ': 'ツ', 'づ': 'ヅ', 'て': 'テ', 'で': 'デ', 'と': 'ト', 'ど': 'ド',
      'な': 'ナ', 'に': 'ニ', 'ぬ': 'ヌ', 'ね': 'ネ', 'の': 'ノ',
      'は': 'ハ', 'ば': 'バ', 'ぱ': 'パ', 'ひ': 'ヒ', 'び': 'ビ', 'ぴ': 'ピ', 'ふ': 'フ', 'ぶ': 'ブ', 'ぷ': 'プ', 'へ': 'ヘ', 'べ': 'ベ', 'ぺ': 'ペ', 'ほ': 'ホ', 'ぼ': 'ボ', 'ぽ': 'ポ',
      'ま': 'マ', 'み': 'ミ', 'む': 'ム', 'め': 'メ', 'も': 'モ',
      'や': 'ヤ', 'ゆ': 'ユ', 'よ': 'ヨ',
      'ら': 'ラ', 'り': 'リ', 'る': 'ル', 'れ': 'レ', 'ろ': 'ロ',
      'わ': 'ワ', 'ゐ': 'ウ', 'ゑ': 'エ', 'を': 'オ', 'ん': 'ン',
      'ー': 'ー'
    };

    const romajiToKatakana = {
      'a': 'ア', 'i': 'イ', 'u': 'ウ', 'e': 'エ', 'o': 'オ',
      'ka': 'カ', 'ki': 'キ', 'ku': 'ク', 'ke': 'ケ', 'ko': 'コ',
      'ga': 'ガ', 'gi': 'ギ', 'gu': 'グ', 'ge': 'ゲ', 'go': 'ゴ',
      'sa': 'サ', 'si': 'シ', 'su': 'ス', 'se': 'セ', 'so': 'ソ',
      'za': 'ザ', 'zi': 'ジ', 'zu': 'ズ', 'ze': 'ゼ', 'zo': 'ゾ',
      'ta': 'タ', 'ti': 'チ', 'tu': 'ツ', 'te': 'テ', 'to': 'ト',
      'da': 'ダ', 'di': 'ヂ', 'du': 'ヅ', 'de': 'デ', 'do': 'ド',
      'na': 'ナ', 'ni': 'ニ', 'nu': 'ヌ', 'ne': 'ネ', 'no': 'ノ',
      'ha': 'ハ', 'hi': 'ヒ', 'hu': 'フ', 'he': 'ヘ', 'ho': 'ホ',
      'ba': 'バ', 'bi': 'ビ', 'bu': 'ブ', 'be': 'ベ', 'bo': 'ボ',
      'pa': 'パ', 'pi': 'ピ', 'pu': 'プ', 'pe': 'ペ', 'po': 'ポ',
      'ma': 'マ', 'mi': 'ミ', 'mu': 'ム', 'me': 'メ', 'mo': 'モ',
      'ya': 'ヤ', 'yu': 'ユ', 'yo': 'ヨ',
      'ra': 'ラ', 'ri': 'リ', 'ru': 'ル', 're': 'レ', 'ro': 'ロ',
      'wa': 'ワ', 'wi': 'ウィ', 'we': 'ウェ', 'wo': 'オ', 'n': 'ン',
      'sha': 'シャ', 'shu': 'シュ', 'sho': 'ショ',
      'cha': 'チャ', 'chu': 'チュ', 'cho': 'チョ',
      'tha': 'タ', 'thu': 'ツ', 'tho': 'ト',
      'dha': 'ダ', 'dhu': 'ヅ', 'dho': 'ド',
      'nya': 'ニャ', 'nyu': 'ニュ', 'nyo': 'ニョ',
      'hya': 'ヒャ', 'hyu': 'ヒュ', 'hyo': 'ヒョ',
      'bya': 'ビャ', 'byu': 'ビュ', 'byo': 'ビョ',
      'pya': 'ピャ', 'pyu': 'ピュ', 'pyo': 'ピョ',
      'mya': 'ミャ', 'myu': 'ミュ', 'myo': 'ミョ',
      'rya': 'リャ', 'ryu': 'リュ', 'ryo': 'リョ',
      'gya': 'ギャ', 'gyu': 'ギュ', 'gyo': 'ギョ',
      'ja': 'ジャ', 'ju': 'ジュ', 'jo': 'ジョ'
    };

    const halfWidthToFull = {
      'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ',
      'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
      'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ',
      'ﾀ': 'タ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
      'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ',
      'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
      'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ',
      'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ',
      'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ',
      'ﾜ': 'ワ', 'ﾝ': 'ン', 'ﾞ': '゛', 'ﾟ': '゜'
    };

    let result = text;

    for (const [halfChar, fullChar] of Object.entries(halfWidthToFull)) {
      result = result.split(halfChar).join(fullChar);
    }

    for (const [hiChar, katChar] of Object.entries(hiraganaToKatakana)) {
      result = result.split(hiChar).join(katChar);
    }

    const sortedRomaji = Object.keys(romajiToKatakana).sort((a, b) => b.length - a.length);
    for (const romaji of sortedRomaji) {
      const regex = new RegExp(romaji, 'gi');
      result = result.replace(regex, romajiToKatakana[romaji]);
    }

    result = result.replace(/[^\u30A0-\u30FF\u3099-\u309C\s\-]/g, '');

    // Convert regular spaces to full-width spaces
    result = result.replace(/ /g, '　');

    // Convert half-width numbers to full-width
    const halfWidthNumbers = {
      '0': '０', '1': '１', '2': '２', '3': '３', '4': '４',
      '5': '５', '6': '６', '7': '７', '8': '８', '9': '９'
    };
    for (const [half, full] of Object.entries(halfWidthNumbers)) {
      result = result.split(half).join(full);
    }

    // Convert hyphens to full-width
    result = result.split('-').join('ー');

    result = result.replace(/\s+/g, '　').trim();

    return result;
  }
}

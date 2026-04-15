const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TANGO_FILE = path.join(__dirname, 'wordlist_ex2kyu_tango.json');
const IDIOM_FILE = path.join(__dirname, 'wordlist_ex2kyu_idiom.json');
const OUTPUT_FILE = path.join(__dirname, 'ex2_quiz.json');

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex').slice(0, 12);
}

const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 不規則活用マッピング
const IRREGULAR_VERBS = {
  'be': '(?:be|am|is|are|was|were|been|being)',
  'have': '(?:have|has|had|having)',
  'get': '(?:get|gets|got|getting|gotten)',
  'come': '(?:come|comes|came|coming)',
  'go': '(?:go|goes|went|going|gone)',
  'run': '(?:run|runs|ran|running)',
  'bring': '(?:bring|brings|brought|bringing)',
  'take': '(?:take|takes|took|taking|taken)',
  'make': '(?:make|makes|made|making)',
  'give': '(?:give|gives|gave|giving|given)',
  'put': '(?:put|puts|putting)',
  'keep': '(?:keep|keeps|kept|keeping)',
  'set': '(?:set|sets|setting)',
  'let': '(?:let|lets|letting)',
  'tell': '(?:tell|tells|told|telling)',
  'say': '(?:say|says|said|saying)',
  'see': '(?:see|sees|saw|seeing|seen)',
  'find': '(?:find|finds|found|finding)',
  'think': '(?:think|thinks|thought|thinking)',
  'know': '(?:know|knows|knew|knowing|known)',
  'stand': '(?:stand|stands|stood|standing)',
  'hold': '(?:hold|holds|held|holding)',
  'fall': '(?:fall|falls|fell|falling|fallen)',
  'leave': '(?:leave|leaves|left|leaving)',
  'break': '(?:break|breaks|broke|breaking|broken)',
  'speak': '(?:speak|speaks|spoke|speaking|spoken)',
  'write': '(?:write|writes|wrote|writing|written)',
  'lose': '(?:lose|loses|lost|losing)',
  'pay': '(?:pay|pays|paid|paying)',
  'cut': '(?:cut|cuts|cutting)',
  'sell': '(?:sell|sells|sold|selling)',
  'catch': '(?:catch|catches|caught|catching)',
  'throw': '(?:throw|throws|threw|throwing|thrown)',
  'turn': '(?:turn|turns|turned|turning)',
  'look': '(?:look|looks|looked|looking)',
  'call': '(?:call|calls|called|calling)',
  'carry': '(?:carry|carries|carried|carrying)',
  'die': '(?:die|dies|died|dying)',
  'lay': '(?:lay|lays|laid|laying)',
  'lie': '(?:lie|lies|lay|lied|lying)',
  'stop': '(?:stop|stops|stopped|stopping)',
  'sit': '(?:sit|sits|sat|sitting)',
  'deal': '(?:deal|deals|dealt|dealing)',
  'dig': '(?:dig|digs|dug|digging)',
  'work': '(?:work|works|worked|working)',
  'pick': '(?:pick|picks|picked|picking)',
  'figure': '(?:figure|figures|figured|figuring)',
  'live': '(?:live|lives|lived|living)',
  'end': '(?:end|ends|ended|ending)',
  'help': '(?:help|helps|helped|helping)',
  'point': '(?:point|points|pointed|pointing)',
  'pass': '(?:pass|passes|passed|passing)',
  'pull': '(?:pull|pulls|pulled|pulling)',
  'hang': '(?:hang|hangs|hung|hanged|hanging)',
  'hand': '(?:hand|hands|handed|handing)',
  'add': '(?:add|adds|added|adding)',
  'rule': '(?:rule|rules|ruled|ruling)',
  'wear': '(?:wear|wears|wore|wearing|worn)',
  'draw': '(?:draw|draws|drew|drawing|drawn)',
};

// Placeholder words that represent variable parts
const PLACEHOLDER_WORDS = new Set(['do', 'does', 'did', 'done', 'doing']);
const PLACEHOLDER_NOUNS = new Set(["a", "one's", "oneself", "someone", "somebody", "something"]);

function buildWordPattern(word) {
  const lw = word.toLowerCase();
  // Check irregular
  if (IRREGULAR_VERBS[lw]) return IRREGULAR_VERBS[lw];
  // Regular inflection  
  return escapeRegExp(word) + '(?:s|es|ed|d|ing|ly|er|est)?';
}

/**
 * For idioms: returns { sentence, matchedAnswer }
 * For words: returns { sentence, matchedAnswer: null }
 */
function replaceBlankIdiom(example, english) {
  let clean = english.replace(/[~～\.\.\.]/g, '').trim();
  
  // 1. Try exact match
  const re1 = new RegExp(escapeRegExp(clean), 'gi');
  if (re1.test(example)) {
    return { sentence: example.replace(re1, '(    )'), matchedAnswer: clean };
  }
  
  // 2. Parse idiom: strip trailing verb placeholder (do/doing/done)
  let parts = clean.split(/\s+/).filter(Boolean);
  
  // Remove trailing placeholder verbs  
  while (parts.length > 0 && PLACEHOLDER_WORDS.has(parts[parts.length - 1].toLowerCase())) {
    parts.pop();
  }
  // Remove placeholder nouns (A, one's, oneself, etc.)
  parts = parts.filter(p => !PLACEHOLDER_NOUNS.has(p.toLowerCase()));
  
  if (parts.length === 0) {
    return { sentence: example, matchedAnswer: null };
  }
  
  // 3. Build flexible regex for remaining parts
  const flexParts = parts.map(p => buildWordPattern(p));
  // Use \s+ between adjacent words, but allow intervening words for A/one's gaps
  const regexStr = flexParts.join('\\s+(?:\\w+\\s+)?');
  
  try {
    const re2 = new RegExp(regexStr, 'gi');
    const match = example.match(re2);
    if (match && match[0]) {
      const matched = match[0];
      // Safety: don't blank more than 60% of the sentence
      if (matched.length < example.length * 0.6) {
        return {
          sentence: example.replace(re2, '(    )'),
          matchedAnswer: matched
        };
      }
    }
  } catch (e) { /* regex error, fall through */ }
  
  // 4. Fallback: blank the most distinctive keyword
  const STOP_WORDS = new Set(['be','do','does','did','done','doing','to','a','an','the','in','on','at','of','for','with','by','from','up','out','off','into','over','about','one','ones']);
  const allParts = clean.split(/\s+/).filter(Boolean);
  const keywords = allParts.filter(p => !STOP_WORDS.has(p.toLowerCase().replace(/'s$/,'')) && p.length > 2);
  if (keywords.length > 0) {
    const keyword = keywords.sort((a, b) => b.length - a.length)[0];
    const reKey = new RegExp('\\b' + escapeRegExp(keyword) + '(?:s|es|ed|d|ing|ly)?\\b', 'gi');
    const km = example.match(reKey);
    if (km && km[0]) {
      return {
        sentence: example.replace(reKey, '(    )'),
        matchedAnswer: km[0]
      };
    }
  }
  
  return { sentence: example, matchedAnswer: null };
}

function replaceBlankWord(example, english) {
  let clean = english.replace(/[~～\.\.\.]/g, '').trim();
  
  // try exact or simple inflection first
  const re1 = new RegExp('\\b' + escapeRegExp(clean) + '(s|es|ed|d|ing|ly)?\\b', 'gi');
  if (re1.test(example)) return example.replace(re1, '(    )');
  
  // rough inflection matching (e.g. changing y->i, dropping e)
  if (clean.length > 3) {
    const base = clean.substring(0, clean.length - 1);
    const re2 = new RegExp('\\b' + escapeRegExp(base) + '[a-z]{0,4}\\b', 'gi');
    if (re2.test(example)) return example.replace(re2, '(    )');
  }
  return example;
}

function processData(rawData, type) {
  return rawData.map(d => ({ ...d, type }));
}

// Clean idiom text for display: remove ~, ?, ..., trailing placeholders
function cleanIdiomDisplay(text) {
  return text
    .replace(/[~～〜…]/g, '')
    .replace(/\.\.\./g, '')
    .replace(/[？?]/g, '')
    .replace(/\b(do|doing|done)\s*$/i, '')
    .replace(/\bA\b/g, '')
    .replace(/\bone's\b/gi, "one's")
    .replace(/\s+/g, ' ')
    .trim();
}

function main() {
  let tango = [];
  let idiom = [];
  
  if (fs.existsSync(TANGO_FILE)) {
    tango = JSON.parse(fs.readFileSync(TANGO_FILE, 'utf8'));
  } else {
    console.warn("Tango file not found:", TANGO_FILE);
  }
  
  if (fs.existsSync(IDIOM_FILE)) {
    idiom = JSON.parse(fs.readFileSync(IDIOM_FILE, 'utf8'));
  } else {
    console.warn("Idiom file not found:", IDIOM_FILE);
  }

  const allRaw = [...processData(tango, 'word'), ...processData(idiom, 'idiom')];
  const allFiltered = allRaw.filter(d => d.english && d.example);
  
  // Pre-compute cleaned idiom display names for distractor selection
  const idiomDisplayMap = new Map();
  allFiltered.filter(d => d.type === 'idiom').forEach(d => {
    idiomDisplayMap.set(d.english, cleanIdiomDisplay(d.english));
  });
  
  const quizData = [];

  allFiltered.forEach(q => {
    // Determine section (e.g., 単語 1-100, 単語 101-200)
    const sectionStart = Math.floor((q.rank - 1) / 100) * 100 + 1;
    const sectionEnd = sectionStart + 99;
    const typeLabel = q.type === 'word' ? '単語' : '熟語';
    const sectionName = `${typeLabel} ${sectionStart}-${sectionEnd}`;

    let sentence, answerDisplay;
    
    if (q.type === 'idiom') {
      const result = replaceBlankIdiom(q.example, q.english);
      sentence = result.sentence;
      answerDisplay = result.matchedAnswer || cleanIdiomDisplay(q.english);
    } else {
      sentence = replaceBlankWord(q.example, q.english);
      answerDisplay = q.english;
    }
    
    // Generate distractors
    const sameTypeData = allFiltered.filter(d => d.type === q.type && d.english !== q.english);
    
    if (q.type === 'idiom') {
      // For idioms: prefer distractors with similar word count
      const answerWords = answerDisplay.split(/\s+/).length;
      // Sort by word count similarity, then randomize within groups
      sameTypeData.sort((a, b) => {
        const aClean = idiomDisplayMap.get(a.english) || cleanIdiomDisplay(a.english);
        const bClean = idiomDisplayMap.get(b.english) || cleanIdiomDisplay(b.english);
        const aDiff = Math.abs(aClean.split(/\s+/).length - answerWords);
        const bDiff = Math.abs(bClean.split(/\s+/).length - answerWords);
        if (aDiff !== bDiff) return aDiff - bDiff;
        return Math.random() - 0.5;
      });
    } else {
      // Shuffle for words
      sameTypeData.sort(() => Math.random() - 0.5);
    }
    
    const distractors = [];
    const usedWords = new Set([answerDisplay.toLowerCase()]);
    
    for (let i = 0; i < sameTypeData.length && distractors.length < 3; i++) {
      const dist = sameTypeData[i];
      const displayWord = q.type === 'idiom' 
        ? (idiomDisplayMap.get(dist.english) || cleanIdiomDisplay(dist.english))
        : dist.english;
      
      // Skip if duplicate display text
      if (usedWords.has(displayWord.toLowerCase())) continue;
      usedWords.add(displayWord.toLowerCase());
      
      distractors.push({
        word: displayWord,
        translation: dist.meanings,
        correct: false
      });
    }

    const choices = [
      {
        word: answerDisplay,
        translation: q.meanings,
        correct: true
      },
      ...distractors
    ];
    // shuffle choices
    choices.sort(() => Math.random() - 0.5);

    quizData.push({
      id: `ex2-${q.type}-${q.rank}`,
      tier: 1,
      section: sectionName,
      page: `r.${q.rank}`,
      type: q.type,
      sentence: sentence,
      sentence_ja: q.exampleJa,
      answer: answerDisplay,
      answer_translation: q.meanings,
      idiom_dict: q.type === 'idiom' ? q.english : undefined,
      choices: choices,
      audioHash: md5(q.example)
    });
  });

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(quizData, null, 2), 'utf8');
  console.log(`Generated ex2_quiz.json with ${quizData.length} items.`);
}

main();

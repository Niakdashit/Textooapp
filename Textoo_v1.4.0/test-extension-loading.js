// Test simple de chargement d'extension
console.log('🔍 Test de chargement de l\'extension Textoo...');

// Vérifier les constantes globales
console.log('IS_GMAIL:', typeof IS_GMAIL !== 'undefined' ? IS_GMAIL : 'Non défini');
console.log('IS_OUTLOOK:', typeof IS_OUTLOOK !== 'undefined' ? IS_OUTLOOK : 'Non défini');

// Vérifier l'URL actuelle
console.log('URL actuelle:', window.location.href);
console.log('Hostname:', window.location.hostname);

// Test de détection Outlook
const isOutlookDetected = /outlook\.(live|office)\.com$/.test(window.location.hostname);
console.log('Détection Outlook:', isOutlookDetected);

// Vérifier les éléments de l'extension
const fab = document.getElementById('hmw-fab');
const menu = document.getElementById('hmw-menu');
const panel = document.getElementById('hmw-box');
const overlays = document.querySelectorAll('.textoo-overlay');

console.log('FAB trouvé:', !!fab);
console.log('Menu trouvé:', !!menu);
console.log('Panneau trouvé:', !!panel);
console.log('Overlays trouvés:', overlays.length);

// Vérifier les fonctions globales
console.log('TextooOfflineChecker:', typeof TextooOfflineChecker !== 'undefined');

// Test de détection de composer
function testComposerDetection() {
  console.log('\n📝 Test de détection du composer...');
  
  const selectors = [
    'div[aria-label="Message body"]',
    'div[role="textbox"][aria-label*="message"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[data-testid="rooster-editor"]',
    'div[contenteditable="true"]',
    'textarea[aria-label*="message"]'
  ];
  
  let found = false;
  selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      console.log(`✅ Trouvé ${elements.length} élément(s) avec: ${selector}`);
      found = true;
    }
  });
  
  return found;
}

// Test de récupération de message
function testMessageRetrieval() {
  console.log('\n📨 Test de récupération de message...');
  
  const messageElements = document.querySelectorAll('div, p, span');
  let bestScore = 0;
  let bestCandidate = '';
  
  for (let i = 0; i < Math.min(messageElements.length, 100); i++) {
    const element = messageElements[i];
    const txt = element.innerText || element.textContent || '';
    
    if (txt && txt.trim().length > 30 && txt.trim().length < 1000) {
      const lowerTxt = txt.toLowerCase();
      let score = 0;
      
      if (lowerTxt.includes('bonjour')) score += 2;
      if (lowerTxt.includes('formation')) score += 3;
      if (lowerTxt.includes('planning')) score += 3;
      if (lowerTxt.includes('confirmer')) score += 2;
      
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = txt.trim();
      }
    }
  }
  
  console.log(`Meilleur score: ${bestScore}`);
  if (bestCandidate) {
    console.log(`Contenu: "${bestCandidate.substring(0, 100)}..."`);
  }
  
  return bestScore > 0;
}

// Exécuter les tests
setTimeout(() => {
  console.log('\n🧪 Exécution des tests...');
  
  const composerFound = testComposerDetection();
  const messageFound = testMessageRetrieval();
  
  console.log('\n📊 Résultats:');
  console.log('Composer détecté:', composerFound ? '✅' : '❌');
  console.log('Message détecté:', messageFound ? '✅' : '❌');
  console.log('Extension chargée:', (fab || overlays.length > 0) ? '✅' : '❌');
  
}, 1000);

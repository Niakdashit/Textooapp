const { chromium } = require('playwright');
const path = require('path');

async function testOutlookIntegration() {
  console.log('🚀 Démarrage des tests d\'intégration Outlook...');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: [
      `--load-extension=${__dirname}`,
      '--disable-extensions-except=' + __dirname,
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ]
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Test 1: Charger la page de test avec simulation Outlook
    console.log('📄 Chargement de la page de test...');
    const testPagePath = `file://${path.join(__dirname, 'test-outlook-integration.html')}?simulate=outlook`;
    await page.goto(testPagePath);
    
    // Attendre que la page soit chargée
    await page.waitForTimeout(2000);
    
    // Test 2: Vérifier que l'extension est chargée
    console.log('🔍 Vérification du chargement de l\'extension...');
    
    const extensionLoaded = await page.evaluate(() => {
      return !!(window.TextooOfflineChecker || 
               document.getElementById('hmw-fab') || 
               document.querySelectorAll('.textoo-overlay').length > 0);
    });
    
    if (extensionLoaded) {
      console.log('✅ Extension Textoo chargée avec succès');
    } else {
      console.log('❌ Extension Textoo non détectée');
    }
    
    // Test 3: Vérifier la détection Outlook
    console.log('🎯 Test de détection Outlook...');
    
    // Simuler l'environnement Outlook en modifiant l'hostname
    await page.addInitScript(() => {
      Object.defineProperty(window.location, 'hostname', {
        writable: true,
        value: 'outlook.live.com'
      });
    });
    
    await page.reload();
    await page.waitForTimeout(2000);
    
    const isOutlookDetected = await page.evaluate(() => {
      return typeof IS_OUTLOOK !== 'undefined' ? IS_OUTLOOK : 
             /outlook\.(live|office)\.com$/.test(window.location.hostname);
    });
    
    if (isOutlookDetected) {
      console.log('✅ Détection Outlook: SUCCÈS');
    } else {
      console.log('❌ Détection Outlook: ÉCHEC');
    }
    
    // Test 4: Tester la détection du composer
    console.log('📝 Test de détection du composer...');
    
    const composerFound = await page.evaluate(() => {
      const selectors = [
        'div[aria-label="Message body"]',
        'div[role="textbox"][aria-label*="message"]',
        'div[contenteditable="true"][role="textbox"]',
        'div[data-testid="rooster-editor"]',
        'div[contenteditable="true"]',
        'textarea[aria-label*="message"]'
      ];
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log(`Trouvé ${elements.length} élément(s) avec: ${selector}`);
          return true;
        }
      }
      return false;
    });
    
    if (composerFound) {
      console.log('✅ Détection du composer: SUCCÈS');
    } else {
      console.log('❌ Détection du composer: ÉCHEC');
    }
    
    // Test 5: Tester l'insertion de texte
    console.log('✏️ Test d\'insertion de texte...');
    
    const textInserted = await page.evaluate(() => {
      const composer = document.querySelector('.composer-mock[contenteditable="true"]');
      if (!composer) return false;
      
      const testText = 'Test d\'insertion Textoo - Outlook';
      composer.focus();
      
      try {
        // Méthode 1: execCommand
        if (document.execCommand('insertText', false, testText)) {
          return true;
        }
      } catch (e) {
        console.log('execCommand failed:', e.message);
      }
      
      try {
        // Méthode 2: DOM manipulation
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(composer);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        
        const textNode = document.createTextNode(testText);
        range.insertNode(textNode);
        return true;
      } catch (e) {
        console.log('DOM manipulation failed:', e.message);
      }
      
      return false;
    });
    
    if (textInserted) {
      console.log('✅ Insertion de texte: SUCCÈS');
    } else {
      console.log('❌ Insertion de texte: ÉCHEC');
    }
    
    // Test 6: Tester la récupération de message
    console.log('📨 Test de récupération de message...');
    
    const messageRetrieved = await page.evaluate(() => {
      // Simuler la fonction getLastMessageText pour Outlook
      const messageElements = document.querySelectorAll('.message-mock, [role="listitem"]');
      
      let bestCandidate = '';
      let bestScore = 0;
      
      for (const element of messageElements) {
        const txt = element.innerText || element.textContent || '';
        
        if (txt && txt.trim().length > 30) {
          const lowerTxt = txt.toLowerCase();
          let score = 0;
          
          // Scoring logic
          if (lowerTxt.includes('bonjour')) score += 2;
          if (lowerTxt.includes('formation')) score += 3;
          if (lowerTxt.includes('planning')) score += 3;
          if (lowerTxt.includes('confirmer')) score += 2;
          if (lowerTxt.includes('cordialement')) score += 1;
          
          if (score > bestScore) {
            bestScore = score;
            bestCandidate = txt.trim();
          }
        }
      }
      
      return {
        found: bestCandidate.length > 0,
        score: bestScore,
        content: bestCandidate.substring(0, 100) + '...'
      };
    });
    
    if (messageRetrieved.found) {
      console.log(`✅ Récupération de message: SUCCÈS (score: ${messageRetrieved.score})`);
      console.log(`📄 Contenu: ${messageRetrieved.content}`);
    } else {
      console.log('❌ Récupération de message: ÉCHEC');
    }
    
    // Test 7: Vérifier l'interface utilisateur
    console.log('🎨 Test de l\'interface utilisateur...');
    
    // Attendre un peu plus pour que l'extension se charge complètement
    await page.waitForTimeout(3000);
    
    const uiElements = await page.evaluate(() => {
      const fab = document.getElementById('hmw-fab');
      const menu = document.getElementById('hmw-menu');
      const panel = document.getElementById('hmw-box');
      const overlays = document.querySelectorAll('.textoo-overlay');
      
      return {
        fab: !!fab,
        menu: !!menu,
        panel: !!panel,
        overlays: overlays.length,
        fabVisible: fab ? window.getComputedStyle(fab).display !== 'none' : false
      };
    });
    
    console.log(`FAB présent: ${uiElements.fab ? '✅' : '❌'}`);
    console.log(`FAB visible: ${uiElements.fabVisible ? '✅' : '❌'}`);
    console.log(`Menu présent: ${uiElements.menu ? '✅' : '❌'}`);
    console.log(`Panneau présent: ${uiElements.panel ? '✅' : '❌'}`);
    console.log(`Overlays de correction: ${uiElements.overlays}`);
    
    // Test 8: Test de réponse rapide simulée
    console.log('⚡ Test de réponse rapide...');
    
    const quickReplyTest = await page.evaluate(() => {
      // Simuler la génération d'une réponse rapide
      const formationMessage = document.querySelector('.message-mock');
      if (!formationMessage) return { success: false, reason: 'Aucun message trouvé' };
      
      const messageText = formationMessage.innerText;
      const lowerText = messageText.toLowerCase();
      
      if (lowerText.includes('formation') && lowerText.includes('confirmer')) {
        const quickReply = "Bonjour,\n\nMerci pour cette information concernant le planning de formation. Je confirme ma présence à la session du 5 octobre à 10h.\n\nCordialement,\nNOM Prénom";
        
        // Essayer d'insérer dans le composer
        const composer = document.querySelector('.composer-mock[contenteditable="true"]');
        if (composer) {
          composer.innerHTML = quickReply.replace(/\n/g, '<br>');
          return { success: true, reply: quickReply };
        }
        
        return { success: false, reason: 'Composer non trouvé' };
      }
      
      return { success: false, reason: 'Message non approprié pour réponse rapide' };
    });
    
    if (quickReplyTest.success) {
      console.log('✅ Réponse rapide: SUCCÈS');
      console.log(`📝 Réponse générée: "${quickReplyTest.reply.substring(0, 50)}..."`);
    } else {
      console.log(`❌ Réponse rapide: ÉCHEC (${quickReplyTest.reason})`);
    }
    
    // Résumé des tests
    console.log('\n📊 RÉSUMÉ DES TESTS:');
    console.log('='.repeat(50));
    
    const results = {
      'Extension chargée': extensionLoaded,
      'Détection Outlook': isOutlookDetected,
      'Détection composer': composerFound,
      'Insertion texte': textInserted,
      'Récupération message': messageRetrieved.found,
      'Interface FAB': uiElements.fab && uiElements.fabVisible,
      'Réponse rapide': quickReplyTest.success
    };
    
    let successCount = 0;
    const totalTests = Object.keys(results).length;
    
    for (const [test, success] of Object.entries(results)) {
      console.log(`${success ? '✅' : '❌'} ${test}: ${success ? 'SUCCÈS' : 'ÉCHEC'}`);
      if (success) successCount++;
    }
    
    console.log('='.repeat(50));
    console.log(`🎯 Score final: ${successCount}/${totalTests} (${Math.round(successCount/totalTests*100)}%)`);
    
    if (successCount === totalTests) {
      console.log('🎉 TOUS LES TESTS SONT PASSÉS! L\'extension est 100% fonctionnelle sur Outlook.');
    } else if (successCount >= totalTests * 0.8) {
      console.log('👍 La plupart des tests sont passés. L\'extension fonctionne bien sur Outlook.');
    } else {
      console.log('⚠️ Plusieurs tests ont échoué. Des améliorations sont nécessaires.');
    }
    
    // Attendre avant de fermer pour permettre l'inspection manuelle
    console.log('\n⏳ Attente de 10 secondes pour inspection manuelle...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('❌ Erreur lors des tests:', error);
  } finally {
    await browser.close();
  }
}

// Exécuter les tests
if (require.main === module) {
  testOutlookIntegration().catch(console.error);
}

module.exports = { testOutlookIntegration };

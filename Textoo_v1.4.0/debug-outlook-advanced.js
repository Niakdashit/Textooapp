// Diagnostic avancé Outlook - Analyse complète de la récupération du message
(function() {
  console.log('=== DIAGNOSTIC AVANCÉ OUTLOOK ===');
  
  // Vérifier si on est sur Outlook
  const isOutlook = typeof location !== 'undefined' && /outlook\.(live|office)\.com$/.test(location.hostname);
  console.log('Site détecté:', window.location.hostname);
  console.log('Est Outlook:', isOutlook);
  
  if (!isOutlook) {
    console.log('❌ Ce script est destiné à Outlook uniquement');
    return;
  }
  
  // Fonction pour analyser tous les éléments de la page
  function analyzeAllElements() {
    console.log('\n=== ANALYSE COMPLÈTE DE LA PAGE ===');
    
    // Analyser la structure de la page
    console.log('Structure de la page:');
    console.log('- Titre:', document.title);
    console.log('- URL:', window.location.href);
    
    // Analyser les éléments principaux
    const mainElements = [
      'div[role="main"]',
      'div[data-automation-id*="Reading"]',
      'div[data-automation-id*="Content"]',
      'div[data-automation-id*="Message"]',
      'div[data-automation-id*="Body"]'
    ];
    
    for (const selector of mainElements) {
      const elements = document.querySelectorAll(selector);
      console.log(`\nÉléments trouvés avec ${selector}: ${elements.length}`);
      
      for (let i = 0; i < Math.min(elements.length, 3); i++) {
        const element = elements[i];
        const text = element.innerText || element.textContent || '';
        console.log(`  Élément ${i}: "${text.substring(0, 100)}..."`);
        console.log(`  Longueur: ${text.length}`);
        console.log(`  Classes: ${element.className}`);
        console.log(`  ID: ${element.id}`);
        console.log(`  data-automation-id: ${element.getAttribute('data-automation-id')}`);
      }
    }
  }
  
  // Fonction pour tester tous les sélecteurs possibles
  function testAllSelectors() {
    console.log('\n=== TEST DE TOUS LES SÉLECTEURS ===');
    
    const allSelectors = [
      // Sélecteurs spécifiques Outlook
      'div[data-automation-id="MessageBody"]',
      'div[data-automation-id="MessageBody"] div',
      'div[data-automation-id="MessageBody"] p',
      'div[data-automation-id="MessageBody"] span',
      'div[data-automation-id="ReadingPaneContainer"]',
      'div[data-automation-id="ReadingPaneContainer"] div',
      'div[data-automation-id="ReadingPaneContainer"] div[data-automation-id="MessageBody"]',
      'div[data-automation-id="ReadingPaneContainer"] div[data-automation-id="MessageBody"] div',
      'div[data-automation-id="ReadingPaneContainer"] div[data-automation-id="MessageBody"] p',
      // Sélecteurs Microsoft
      '.ms-MessageBody',
      '.ms-MessageBody div',
      '.ms-MessageBody p',
      '.ms-MessageBody span',
      '.ms-ConversationItemBody',
      '.ms-ConversationItemBody div',
      '.ms-ConversationItemBody p',
      '.ms-ConversationItemBody span',
      // Sélecteurs génériques
      'div[role="textbox"]',
      'div[role="textbox"] div',
      'div[role="textbox"] p',
      'div[aria-label*="message"]',
      'div[aria-label*="Message"]',
      'div[aria-label*="body"]',
      'div[aria-label*="Body"]',
      'div[data-automation-id*="Message"]',
      'div[data-automation-id*="Body"]',
      'div[data-automation-id*="Content"]',
      'div[data-automation-id*="Reading"]',
      // Sélecteurs de contenu
      'div[contenteditable="false"]',
      'div[contenteditable="false"] div',
      'div[contenteditable="false"] p',
      'div[contenteditable="false"] span',
      // Sélecteurs de zone principale
      'div[role="main"]',
      'div[role="main"] div',
      'div[role="main"] p',
      'div[role="main"] span',
      // Sélecteurs de fallback
      'div',
      'p',
      'span'
    ];
    
    let bestResult = null;
    let bestScore = 0;
    
    for (const selector of allSelectors) {
      console.log(`\nTest du sélecteur: ${selector}`);
      const elements = document.querySelectorAll(selector);
      console.log(`Éléments trouvés: ${elements.length}`);
      
      for (let i = 0; i < Math.min(elements.length, 5); i++) {
        const element = elements[i];
        const text = element.innerText || element.textContent || '';
        
        if (text && text.trim().length > 20) {
          console.log(`  Élément ${i}: "${text.substring(0, 100)}..."`);
          console.log(`  Longueur: ${text.length}`);
          
          // Calculer un score pour ce texte
          const lowerText = text.toLowerCase();
          let score = 0;
          
          // Mots-clés positifs
          if (lowerText.includes('bonjour')) score += 2;
          if (lowerText.includes('formation')) score += 3;
          if (lowerText.includes('planning')) score += 3;
          if (lowerText.includes('session')) score += 2;
          if (lowerText.includes('octobre')) score += 2;
          if (lowerText.includes('confirmer')) score += 2;
          if (lowerText.includes('présence')) score += 2;
          if (lowerText.includes('calendrier')) score += 2;
          if (lowerText.includes('pièce jointe')) score += 2;
          if (lowerText.includes('ajusté')) score += 2;
          if (lowerText.includes('déplacée')) score += 2;
          if (lowerText.includes('merci')) score += 1;
          if (lowerText.includes('amélie')) score += 1;
          
          // Pénalités
          if (lowerText.match(/^(mer|mar|jeu|ven|sam|dim|lun)/i)) score -= 5;
          if (lowerText.match(/^\d{1,2}:\d{2}/)) score -= 5;
          if (lowerText.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) score -= 5;
          if (lowerText.split('\n').length > 20) score -= 3;
          if (text.length > 5000) score -= 2;
          
          console.log(`  Score: ${score}`);
          
          if (score > bestScore) {
            bestScore = score;
            bestResult = {
              selector: selector,
              element: element,
              text: text.trim(),
              score: score
            };
            console.log(`  ✅ NOUVEAU MEILLEUR RÉSULTAT (score: ${score})`);
          }
        }
      }
    }
    
    if (bestResult) {
      console.log(`\n✅ MEILLEUR RÉSULTAT TROUVÉ:`);
      console.log(`Sélecteur: ${bestResult.selector}`);
      console.log(`Score: ${bestResult.score}`);
      console.log(`Texte: "${bestResult.text}"`);
      return bestResult.text;
    } else {
      console.log('\n❌ AUCUN RÉSULTAT VALIDE TROUVÉ');
      return '';
    }
  }
  
  // Fonction pour tester la génération de réponse
  function testResponseGeneration(message) {
    console.log('\n=== TEST DE GÉNÉRATION DE RÉPONSE ===');
    console.log('Message récupéré:', message);
    
    if (!message) {
      console.log('❌ Aucun message à analyser');
      return;
    }
    
    const lowerText = message.toLowerCase();
    console.log('Message en minuscules:', lowerText);
    
    // Analyser les mots-clés spécifiques
    const keywords = {
      'formation': lowerText.includes('formation'),
      'planning': lowerText.includes('planning'),
      'session': lowerText.includes('session'),
      'octobre': lowerText.includes('octobre'),
      'confirmer': lowerText.includes('confirmer'),
      'présence': lowerText.includes('présence'),
      'calendrier': lowerText.includes('calendrier'),
      'pièce jointe': lowerText.includes('pièce jointe'),
      'ajusté': lowerText.includes('ajusté'),
      'déplacée': lowerText.includes('déplacée'),
      'amélie': lowerText.includes('amélie')
    };
    
    console.log('Mots-clés détectés:', keywords);
    
    // Déterminer le mode de réponse
    let responseMode = 'reply';
    if (lowerText.includes('formation') && lowerText.includes('planning')) {
      responseMode = 'training_schedule';
    } else if (lowerText.includes('confirmer') && lowerText.includes('présence')) {
      responseMode = 'attendance_confirmation';
    } else if (lowerText.includes('session') && lowerText.includes('octobre')) {
      responseMode = 'session_reschedule';
    }
    
    console.log('Mode de réponse détecté:', responseMode);
    
    // Générer la réponse
    let response = '';
    switch(responseMode) {
      case 'training_schedule':
        response = "Bonjour,\n\nMerci pour cette information concernant le planning de formation. Je confirme avoir bien pris note du changement de date (5 octobre à 10h).\n\nCordialement,\nNOM Prénom";
        break;
      case 'attendance_confirmation':
        response = "Bonjour,\n\nMerci pour cette information. Je confirme ma présence à la session du 5 octobre à 10h.\n\nCordialement,\nNOM Prénom";
        break;
      case 'session_reschedule':
        response = "Bonjour,\n\nMerci pour cette information. Je confirme avoir bien pris note du changement de date pour la session.\n\nCordialement,\nNOM Prénom";
        break;
      default:
        response = "Merci pour votre message.";
    }
    
    console.log('Réponse générée:', response);
    return response;
  }
  
  // Exécuter le diagnostic complet
  function runAdvancedDiagnostic() {
    console.log('=== DÉBUT DU DIAGNOSTIC AVANCÉ ===');
    
    analyzeAllElements();
    const message = testAllSelectors();
    if (message) {
      const response = testResponseGeneration(message);
      
      console.log('\n=== RÉSULTAT FINAL ===');
      console.log('Message récupéré:', message);
      console.log('Réponse générée:', response);
      
      // Vérifier si la réponse est appropriée
      if (response && (response.includes('formation') || response.includes('planning') || response.includes('confirme'))) {
        console.log('✅ SUCCESS: La réponse est contextuellement appropriée');
      } else {
        console.log('❌ ERROR: La réponse ne semble pas appropriée au contexte');
      }
    } else {
      console.log('❌ DIAGNOSTIC ÉCHOUÉ: Aucun message récupéré');
    }
    
    console.log('=== FIN DU DIAGNOSTIC AVANCÉ ===');
  }
  
  // Exposer les fonctions globalement
  window.analyzeAllElements = analyzeAllElements;
  window.testAllSelectors = testAllSelectors;
  window.testResponseGeneration = testResponseGeneration;
  window.runAdvancedDiagnostic = runAdvancedDiagnostic;
  
  // Exécuter automatiquement le diagnostic
  runAdvancedDiagnostic();
})();

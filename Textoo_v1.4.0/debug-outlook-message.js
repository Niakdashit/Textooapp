// Script de débogage pour Outlook - Récupération du message
(function() {
  console.log('=== DÉBOGAGE OUTLOOK - RÉCUPÉRATION DU MESSAGE ===');
  
  // Vérifier si on est sur Outlook
  const isOutlook = typeof location !== 'undefined' && /outlook\.(live|office)\.com$/.test(location.hostname);
  console.log('Site détecté:', window.location.hostname);
  console.log('Est Outlook:', isOutlook);
  
  if (!isOutlook) {
    console.log('❌ Ce script est destiné à Outlook uniquement');
    return;
  }
  
  // Fonction pour tester tous les sélecteurs Outlook
  function testOutlookSelectors() {
    console.log('\n=== TEST DES SÉLECTEURS OUTLOOK ===');
    
    const selectors = [
      // Sélecteurs spécifiques pour le contenu du message Outlook
      'div[data-automation-id="MessageBody"] div',
      'div[data-automation-id="MessageBody"] p',
      'div[data-automation-id="MessageBody"]',
      // Sélecteurs pour le contenu de lecture
      'div[data-automation-id="ReadingPaneContainer"] div[data-automation-id="MessageBody"]',
      'div[data-automation-id="ReadingPaneContainer"] div[data-automation-id="MessageBody"] div',
      'div[data-automation-id="ReadingPaneContainer"] div[data-automation-id="MessageBody"] p',
      // Sélecteurs pour le corps du message
      '.ms-MessageBody div',
      '.ms-MessageBody p',
      '.ms-ConversationItemBody div',
      '.ms-ConversationItemBody p',
      // Sélecteurs génériques pour le contenu de message
      'div[role="textbox"] div',
      'div[aria-label*="message"] div',
      'div[aria-label*="Message"] div',
      'div[data-automation-id*="Message"] div',
      'div[data-automation-id*="Body"] div',
      // Sélecteurs pour contenu non-éditable
      'div[contenteditable="false"] div',
      'div[contenteditable="false"] p',
      // Sélecteurs pour la zone de lecture
      'div[role="main"] div[data-automation-id*="Message"]',
      'div[role="main"] div[data-automation-id*="Body"]',
      // Sélecteurs de fallback plus larges
      'div[data-automation-id*="Reading"] div',
      'div[data-automation-id*="Content"] div'
    ];
    
    for(const selector of selectors) {
      console.log(`\nTest du sélecteur: ${selector}`);
      const elements = document.querySelectorAll(selector);
      console.log(`Éléments trouvés: ${elements.length}`);
      
      for(let i = elements.length - 1; i >= 0; i--){
        const element = elements[i];
        let txt = '';
        
        // Essayer différentes méthodes de récupération du texte
        if (element.innerText) {
          txt = element.innerText;
        } else if (element.textContent) {
          txt = element.textContent;
        } else if (element.innerHTML) {
          // Extraire le texte du HTML si nécessaire
          const temp = document.createElement('div');
          temp.innerHTML = element.innerHTML;
          txt = temp.innerText || temp.textContent || '';
        }
        
        console.log(`  Élément ${i}: "${txt.substring(0, 100)}..."`);
        console.log(`  Longueur: ${txt.length}`);
        
        // Vérifier que le texte est suffisant et ne contient pas trop de métadonnées
        if(txt && txt.trim().length > 30 && txt.trim().length < 10000) {
          // Filtrer les textes qui semblent être des métadonnées
          const filteredTxt = txt.trim();
          if (!filteredTxt.match(/^(mer|mar|jeu|ven|sam|dim|lun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i) &&
              !filteredTxt.match(/^\d{1,2}:\d{2}/) &&
              !filteredTxt.match(/^\d{1,2}\/\d{1,2}\/\d{4}/) &&
              filteredTxt.includes(' ') && // Doit contenir des espaces (pas juste un mot)
              filteredTxt.split('\n').length <= 50) { // Pas trop de lignes
            console.log(`✅ MESSAGE OUTLOOK TROUVÉ avec ${selector}:`);
            console.log(`Contenu complet: "${filteredTxt}"`);
            return filteredTxt;
          }
        }
      }
    }
    
    // Test de fallback
    console.log('\n=== TEST FALLBACK ===');
    const mainContent = document.querySelector('div[role="main"], div[data-automation-id*="Reading"], div[data-automation-id*="Content"]');
    if(mainContent) {
      const allText = mainContent.innerText || mainContent.textContent || '';
      console.log(`Fallback - texte de la zone principale: "${allText.substring(0, 200)}..."`);
      if(allText.trim().length > 40) {
        console.log(`✅ Message trouvé via fallback: "${allText.trim()}"`);
        return allText.trim();
      }
    }
    
    console.log('❌ Aucun message Outlook trouvé');
    return '';
  }
  
  // Fonction pour analyser le contenu du message
  function analyzeMessageContent(message) {
    if (!message) {
      console.log('❌ Aucun message à analyser');
      return;
    }
    
    console.log('\n=== ANALYSE DU CONTENU DU MESSAGE ===');
    console.log('Longueur du message:', message.length);
    console.log('Message complet:', message);
    
    const lowerText = message.toLowerCase();
    console.log('\n=== DÉTECTION DU TYPE DE MESSAGE ===');
    
    // Vérifier les mots-clés spécifiques
    const keywords = {
      'préciser': lowerText.includes('préciser'),
      'détails': lowerText.includes('détails'),
      'sujet': lowerText.includes('sujet'),
      'questions': lowerText.includes('questions'),
      'aide': lowerText.includes('aide'),
      'contacter': lowerText.includes('contacter'),
      'documentation': lowerText.includes('documentation'),
      'lien': lowerText.includes('lien'),
      'bienvenu': lowerText.includes('bienvenu'),
      'permets': lowerText.includes('permets')
    };
    
    console.log('Mots-clés détectés:', keywords);
    
    // Déterminer le mode de réponse
    let responseMode = 'reply';
    if (lowerText.includes('préciser') || lowerText.includes('détails')) {
      responseMode = 'information_request';
    } else if (lowerText.includes('question') || lowerText.includes('?')) {
      responseMode = 'question_reply';
    } else if (lowerText.includes('aide')) {
      responseMode = 'help_request';
    }
    
    console.log('Mode de réponse détecté:', responseMode);
    
    return responseMode;
  }
  
  // Fonction pour tester la génération de réponse
  function testResponseGeneration(message, responseMode) {
    console.log('\n=== TEST DE GÉNÉRATION DE RÉPONSE ===');
    console.log('Message original:', message);
    console.log('Mode de réponse:', responseMode);
    
    // Simuler la fonction generateContextualResponse
    const lowerText = message.toLowerCase();
    let response = '';
    
    switch(responseMode) {
      case 'information_request':
        if (lowerText.includes('préciser') || lowerText.includes('détails')) {
          response = "Bonjour,\n\nMerci pour votre message. Je serais ravi de vous aider. Pourriez-vous me donner plus de précisions sur le sujet que vous souhaitez aborder ? Plus vous me donnerez de détails, mieux je pourrai vous répondre de manière pertinente.\n\nCordialement,\nNOM Prénom";
        } else if (lowerText.includes('sujet') || lowerText.includes('thème')) {
          response = "Bonjour,\n\nMerci pour votre message. Je serais ravi de vous aider sur ce sujet. Pourriez-vous me préciser quel aspect spécifique vous intéresse le plus ? Cela m'aiderait à vous donner une réponse plus ciblée.\n\nCordialement,\nNOM Prénom";
        } else {
          response = "Bonjour,\n\nMerci pour votre message. Je serais ravi de vous aider. Pourriez-vous me donner plus de détails sur ce que vous souhaitez savoir ? Plus vous me donnerez d'informations, mieux je pourrai vous répondre.\n\nCordialement,\nNOM Prénom";
        }
        break;
        
      case 'question_reply':
        response = "Merci pour votre question. Je vais vous répondre dans les plus brefs délais.";
        break;
        
      case 'help_request':
        response = "Bonjour,\n\nMerci pour votre message. Je serais ravi de vous aider. Pouvez-vous me donner plus de détails sur ce dont vous avez besoin ?\n\nCordialement,\nNOM Prénom";
        break;
        
      default:
        response = "Merci pour votre message.";
    }
    
    console.log('Réponse générée:', response);
    return response;
  }
  
  // Exécuter le test complet
  function runCompleteTest() {
    console.log('=== DÉBUT DU TEST COMPLET OUTLOOK ===');
    
    const message = testOutlookSelectors();
    if (message) {
      const responseMode = analyzeMessageContent(message);
      const response = testResponseGeneration(message, responseMode);
      
      console.log('\n=== RÉSULTAT FINAL ===');
      console.log('Message récupéré:', message);
      console.log('Mode de réponse:', responseMode);
      console.log('Réponse générée:', response);
      
      // Vérifier si la réponse est appropriée
      if (response && response.length > 10) {
        console.log('✅ Test réussi - Réponse générée');
      } else {
        console.log('❌ Test échoué - Aucune réponse générée');
      }
    } else {
      console.log('❌ Test échoué - Aucun message récupéré');
    }
    
    console.log('=== FIN DU TEST COMPLET ===');
  }
  
  // Exposer les fonctions globalement
  window.testOutlookSelectors = testOutlookSelectors;
  window.analyzeMessageContent = analyzeMessageContent;
  window.testResponseGeneration = testResponseGeneration;
  window.runCompleteTest = runCompleteTest;
  
  // Exécuter automatiquement le test
  runCompleteTest();
})();

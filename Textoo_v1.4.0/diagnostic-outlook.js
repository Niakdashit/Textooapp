// Diagnostic Outlook - Vérifier la récupération du message
(function() {
  console.log('=== DIAGNOSTIC OUTLOOK - RÉCUPÉRATION DU MESSAGE ===');
  
  // Vérifier si on est sur Outlook
  const isOutlook = typeof location !== 'undefined' && /outlook\.(live|office)\.com$/.test(location.hostname);
  console.log('Site détecté:', window.location.hostname);
  console.log('Est Outlook:', isOutlook);
  
  if (!isOutlook) {
    console.log('❌ Ce script est destiné à Outlook uniquement');
    return;
  }
  
  // Fonction pour diagnostiquer la récupération du message
  function diagnoseMessageRetrieval() {
    console.log('\n=== DIAGNOSTIC DE RÉCUPÉRATION DU MESSAGE ===');
    
    // Tester la fonction getLastMessageText actuelle
    console.log('Test de la fonction getLastMessageText...');
    
    // Simuler la fonction getLastMessageText pour Outlook
    const selectors = [
      'div[data-automation-id="MessageBody"] div',
      'div[data-automation-id="MessageBody"] p',
      'div[data-automation-id="MessageBody"]',
      'div[data-automation-id="ReadingPaneContainer"] div[data-automation-id="MessageBody"]',
      'div[data-automation-id="ReadingPaneContainer"] div[data-automation-id="MessageBody"] div',
      'div[data-automation-id="ReadingPaneContainer"] div[data-automation-id="MessageBody"] p',
      '.ms-MessageBody div',
      '.ms-MessageBody p',
      '.ms-ConversationItemBody div',
      '.ms-ConversationItemBody p',
      'div[role="textbox"] div',
      'div[aria-label*="message"] div',
      'div[aria-label*="Message"] div',
      'div[data-automation-id*="Message"] div',
      'div[data-automation-id*="Body"] div',
      'div[contenteditable="false"] div',
      'div[contenteditable="false"] p',
      'div[role="main"] div[data-automation-id*="Message"]',
      'div[role="main"] div[data-automation-id*="Body"]',
      'div[data-automation-id*="Reading"] div',
      'div[data-automation-id*="Content"] div'
    ];
    
    let foundMessage = false;
    let bestMessage = '';
    let bestSelector = '';
    
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
          const temp = document.createElement('div');
          temp.innerHTML = element.innerHTML;
          txt = temp.innerText || temp.textContent || '';
        }
        
        console.log(`  Élément ${i}: "${txt.substring(0, 100)}..."`);
        console.log(`  Longueur: ${txt.length}`);
        
        // Vérifier si c'est un message valide
        if(txt && txt.trim().length > 30 && txt.trim().length < 10000) {
          const filteredTxt = txt.trim();
          
          // Vérifier que ce n'est pas des métadonnées
          if (!filteredTxt.match(/^(mer|mar|jeu|ven|sam|dim|lun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i) &&
              !filteredTxt.match(/^\d{1,2}:\d{2}/) &&
              !filteredTxt.match(/^\d{1,2}\/\d{1,2}\/\d{4}/) &&
              filteredTxt.includes(' ') &&
              filteredTxt.split('\n').length <= 50) {
            
            // Vérifier si c'est un message de type "demande d'informations"
            if (filteredTxt.toLowerCase().includes('préciser') || 
                filteredTxt.toLowerCase().includes('questions') ||
                filteredTxt.toLowerCase().includes('sujet') ||
                filteredTxt.toLowerCase().includes('aide')) {
              
              console.log(`✅ MESSAGE VALIDE TROUVÉ avec ${selector}:`);
              console.log(`Contenu: "${filteredTxt}"`);
              
              if (filteredTxt.length > bestMessage.length) {
                bestMessage = filteredTxt;
                bestSelector = selector;
                foundMessage = true;
              }
            }
          }
        }
      }
    }
    
    if (foundMessage) {
      console.log(`\n✅ MEILLEUR MESSAGE TROUVÉ avec ${bestSelector}:`);
      console.log(`Contenu: "${bestMessage}"`);
      return bestMessage;
    } else {
      console.log('\n❌ AUCUN MESSAGE VALIDE TROUVÉ');
      
      // Essayer une approche plus large
      console.log('\n=== APPROCHE PLUS LARGE ===');
      const allElements = document.querySelectorAll('div, p, span');
      console.log(`Total d'éléments à analyser: ${allElements.length}`);
      
      for(let i = 0; i < Math.min(allElements.length, 100); i++) {
        const element = allElements[i];
        const txt = element.innerText || element.textContent || '';
        
        if (txt && txt.length > 50 && txt.length < 1000) {
          if (txt.toLowerCase().includes('préciser') || 
              txt.toLowerCase().includes('questions') ||
              txt.toLowerCase().includes('sujet') ||
              txt.toLowerCase().includes('aide')) {
            console.log(`Message potentiel trouvé: "${txt.substring(0, 200)}..."`);
          }
        }
      }
      
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
    
    // Analyser les mots-clés
    const keywords = {
      'préciser': lowerText.includes('préciser'),
      'questions': lowerText.includes('questions'),
      'sujet': lowerText.includes('sujet'),
      'aide': lowerText.includes('aide'),
      'documentation': lowerText.includes('documentation'),
      'lien': lowerText.includes('lien')
    };
    
    console.log('Mots-clés détectés:', keywords);
    
    // Déterminer le mode de réponse
    let responseMode = 'reply';
    if (lowerText.includes('préciser') || lowerText.includes('questions')) {
      responseMode = 'information_request';
    }
    
    console.log('Mode de réponse détecté:', responseMode);
    
    // Générer la réponse
    let response = '';
    switch(responseMode) {
      case 'information_request':
        if (lowerText.includes('questions clés') || lowerText.includes('questions cles')) {
          response = "Bonjour,\n\nMerci pour votre message. Je serais ravi de vous aider. Pourriez-vous me préciser quelles sont les questions clés qui vous intéressent ? Cela m'aiderait à vous donner des réponses plus ciblées et pertinentes.\n\nCordialement,\nNOM Prénom";
        } else if (lowerText.includes('préciser') && lowerText.includes('sujet')) {
          response = "Bonjour,\n\nMerci pour votre message. Je serais ravi de vous aider sur ce sujet. Pourriez-vous me préciser quel aspect spécifique vous intéresse le plus ? Cela m'aiderait à vous donner une réponse plus ciblée.\n\nCordialement,\nNOM Prénom";
        } else if (lowerText.includes('documentation') || lowerText.includes('lien')) {
          response = "Bonjour,\n\nMerci pour votre message. Je serais ravi de vous aider. Pourriez-vous me préciser quel type de documentation ou de lien vous serait le plus utile ? Cela m'aiderait à vous fournir les ressources les plus pertinentes.\n\nCordialement,\nNOM Prénom";
        } else {
          response = "Bonjour,\n\nMerci pour votre message. Je serais ravi de vous aider. Pourriez-vous me donner plus de détails sur ce que vous souhaitez savoir ? Plus vous me donnerez d'informations, mieux je pourrai vous répondre.\n\nCordialement,\nNOM Prénom";
        }
        break;
      default:
        response = "Merci pour votre message.";
    }
    
    console.log('Réponse générée:', response);
    return response;
  }
  
  // Exécuter le diagnostic complet
  function runDiagnostic() {
    console.log('=== DÉBUT DU DIAGNOSTIC COMPLET ===');
    
    const message = diagnoseMessageRetrieval();
    if (message) {
      const response = testResponseGeneration(message);
      
      console.log('\n=== RÉSULTAT FINAL ===');
      console.log('Message récupéré:', message);
      console.log('Réponse générée:', response);
      
      // Vérifier si la réponse est appropriée
      if (response && response.includes('questions clés')) {
        console.log('✅ SUCCESS: La réponse mentionne "questions clés"');
      } else if (response && response.includes('préciser')) {
        console.log('✅ SUCCESS: La réponse demande des précisions');
      } else {
        console.log('❌ ERROR: La réponse ne semble pas appropriée');
      }
    } else {
      console.log('❌ DIAGNOSTIC ÉCHOUÉ: Aucun message récupéré');
    }
    
    console.log('=== FIN DU DIAGNOSTIC ===');
  }
  
  // Exposer les fonctions globalement
  window.diagnoseMessageRetrieval = diagnoseMessageRetrieval;
  window.testResponseGeneration = testResponseGeneration;
  window.runDiagnostic = runDiagnostic;
  
  // Exécuter automatiquement le diagnostic
  runDiagnostic();
})();

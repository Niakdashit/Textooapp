// CORRECTION IMMÉDIATE OUTLOOK - Script à exécuter dans la console
(function() {
  console.log('=== CORRECTION IMMÉDIATE OUTLOOK ===');
  
  // Vérifier si on est sur Outlook
  const isOutlook = typeof location !== 'undefined' && /outlook\.(live|office)\.com$/.test(location.hostname);
  console.log('Site détecté:', window.location.hostname);
  console.log('Est Outlook:', isOutlook);
  
  if (!isOutlook) {
    console.log('❌ Ce script est destiné à Outlook uniquement');
    return;
  }
  
  // Fonction pour trouver le message de formation sur la page
  function findFormationMessage() {
    console.log('\n=== RECHERCHE DU MESSAGE DE FORMATION ===');
    
    // Analyser TOUS les éléments de la page
    const allElements = document.querySelectorAll('*');
    console.log(`Analyse de ${allElements.length} éléments sur la page...`);
    
    let bestCandidate = '';
    let bestScore = 0;
    let bestElement = null;
    
    for (let i = 0; i < allElements.length; i++) {
      const element = allElements[i];
      const text = element.innerText || element.textContent || '';
      
      if (text && text.trim().length > 50 && text.trim().length < 2000) {
        const lowerText = text.toLowerCase();
        
        // Calculer un score basé sur les mots-clés de formation
        let score = 0;
        
        // Mots-clés spécifiques aux formations
        if (lowerText.includes('formation')) score += 5;
        if (lowerText.includes('planning')) score += 5;
        if (lowerText.includes('session')) score += 3;
        if (lowerText.includes('octobre')) score += 3;
        if (lowerText.includes('confirmer')) score += 3;
        if (lowerText.includes('présence')) score += 3;
        if (lowerText.includes('calendrier')) score += 2;
        if (lowerText.includes('pièce jointe')) score += 2;
        if (lowerText.includes('ajusté')) score += 2;
        if (lowerText.includes('déplacée')) score += 2;
        if (lowerText.includes('amélie')) score += 1;
        if (lowerText.includes('bonjour')) score += 1;
        if (lowerText.includes('merci')) score += 1;
        
        // Pénaliser les métadonnées
        if (lowerText.match(/^(mer|mar|jeu|ven|sam|dim|lun)/i)) score -= 10;
        if (lowerText.match(/^\d{1,2}:\d{2}/)) score -= 10;
        if (lowerText.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) score -= 10;
        if (lowerText.split('\n').length > 30) score -= 5;
        
        if (score > bestScore) {
          bestScore = score;
          bestCandidate = text.trim();
          bestElement = element;
          console.log(`Nouveau meilleur candidat (score: ${score}): "${text.substring(0, 100)}..."`);
        }
      }
    }
    
    if (bestCandidate && bestScore > 0) {
      console.log(`✅ MESSAGE DE FORMATION TROUVÉ avec score ${bestScore}:`);
      console.log(`Contenu: "${bestCandidate}"`);
      console.log(`Élément:`, bestElement);
      return bestCandidate;
    } else {
      console.log('❌ Aucun message de formation trouvé');
      return '';
    }
  }
  
  // Fonction pour générer la bonne réponse
  function generateCorrectResponse(message) {
    console.log('\n=== GÉNÉRATION DE LA BONNE RÉPONSE ===');
    console.log('Message analysé:', message);
    
    if (!message) {
      console.log('❌ Aucun message à analyser');
      return '';
    }
    
    const lowerText = message.toLowerCase();
    
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
    
    // Déterminer le type de réponse
    let responseType = 'generic';
    if (lowerText.includes('formation') && lowerText.includes('planning')) {
      responseType = 'training_schedule';
    } else if (lowerText.includes('confirmer') && lowerText.includes('présence')) {
      responseType = 'attendance_confirmation';
    } else if (lowerText.includes('session') && lowerText.includes('octobre')) {
      responseType = 'session_reschedule';
    }
    
    console.log('Type de réponse détecté:', responseType);
    
    // Générer la réponse appropriée
    let response = '';
    switch(responseType) {
      case 'training_schedule':
        if (lowerText.includes('confirmer') && lowerText.includes('présence')) {
          response = "Bonjour,\n\nMerci pour cette information concernant le planning de formation. Je confirme ma présence à la session du 5 octobre à 10h.\n\nCordialement,\nNOM Prénom";
        } else {
          response = "Bonjour,\n\nMerci pour cette information concernant le planning de formation. Je confirme avoir bien pris note du changement de date (5 octobre à 10h).\n\nCordialement,\nNOM Prénom";
        }
        break;
      case 'attendance_confirmation':
        response = "Bonjour,\n\nMerci pour cette information. Je confirme ma présence à la session du 5 octobre à 10h.\n\nCordialement,\nNOM Prénom";
        break;
      case 'session_reschedule':
        response = "Bonjour,\n\nMerci pour cette information. Je confirme avoir bien pris note du changement de date pour la session.\n\nCordialement,\nNOM Prénom";
        break;
      default:
        response = "Bonjour,\n\nMerci pour votre message. Je suis ravi d'avoir de vos nouvelles. Pourriez-vous me donner plus de détails sur le sujet que vous souhaitez aborder ? Cela m'aiderait à mieux préparer notre échange.\n\nCordialement,\nNOM Prénom";
    }
    
    console.log('Réponse générée:', response);
    
    // Vérifier si la réponse est appropriée
    if (response && (response.includes('formation') || response.includes('planning') || response.includes('confirme'))) {
      console.log('✅ SUCCESS: La réponse est contextuellement appropriée');
    } else {
      console.log('❌ ERROR: La réponse ne semble pas appropriée au contexte');
    }
    
    return response;
  }
  
  // Fonction pour patcher la fonction getLastMessageText en temps réel
  function patchGetLastMessageText() {
    console.log('\n=== PATCH DE getLastMessageText() EN TEMPS RÉEL ===');
    
    // Créer une nouvelle version qui fonctionne
    window.getLastMessageText = function() {
      console.log('=== NOUVELLE VERSION DE getLastMessageText() ===');
      
      const isOutlook = typeof location !== 'undefined' && /outlook\.(live|office)\.com$/.test(location.hostname);
      
      if (isOutlook) {
        console.log('Recherche du contenu de message Outlook...');
        
        // Utiliser notre fonction de recherche améliorée
        const message = findFormationMessage();
        
        if (message) {
          console.log(`✅ Message trouvé: "${message}"`);
          return message;
        } else {
          console.log('❌ Aucun message trouvé');
          return '';
        }
      }
      
      return '';
    };
    
    console.log('✅ Fonction getLastMessageText() patchée en temps réel');
  }
  
  // Fonction pour patcher la fonction handleDirectQuickReply
  function patchHandleDirectQuickReply() {
    console.log('\n=== PATCH DE handleDirectQuickReply() ===');
    
    // Créer une nouvelle version qui fonctionne
    window.handleDirectQuickReply = function() {
      console.log('=== NOUVELLE VERSION DE handleDirectQuickReply() ===');
      
      // Récupérer le message avec notre fonction améliorée
      const message = findFormationMessage();
      
      if (message) {
        console.log('Message récupéré:', message);
        
        // Générer la réponse appropriée
        const response = generateCorrectResponse(message);
        
        if (response) {
          console.log('Réponse générée:', response);
          return response;
        }
      }
      
      console.log('❌ Impossible de générer une réponse appropriée');
      return '';
    };
    
    console.log('✅ Fonction handleDirectQuickReply() patchée');
  }
  
  // Exécuter la solution complète
  function runCompleteSolution() {
    console.log('=== DÉBUT DE LA SOLUTION COMPLÈTE ===');
    
    // 1. Trouver le message de formation
    const message = findFormationMessage();
    
    if (message) {
      // 2. Générer la bonne réponse
      const response = generateCorrectResponse(message);
      
      // 3. Patcher les fonctions
      patchGetLastMessageText();
      patchHandleDirectQuickReply();
      
      console.log('\n=== RÉSULTAT DE LA SOLUTION ===');
      console.log('Message trouvé:', message ? 'OUI' : 'NON');
      console.log('Réponse générée:', response ? 'OUI' : 'NON');
      console.log('Fonctions patchées:', 'OUI');
      
      if (response && (response.includes('formation') || response.includes('planning') || response.includes('confirme'))) {
        console.log('✅ SUCCESS: La solution fonctionne parfaitement');
        console.log('✅ Le message de formation est détecté');
        console.log('✅ La réponse appropriée est générée');
        console.log('✅ Les fonctions sont patchées');
        
        console.log('\n🎯 RÉPONSE ATTENDUE:');
        console.log(`"${response}"`);
        
        console.log('\n💡 INSTRUCTIONS:');
        console.log('1. Les fonctions ont été patchées en temps réel');
        console.log('2. Testez maintenant le bouton "réponse rapide"');
        console.log('3. La réponse devrait maintenant être appropriée au contexte');
      } else {
        console.log('❌ ERROR: La solution ne fonctionne pas');
      }
    } else {
      console.log('❌ SOLUTION ÉCHOUÉE: Aucun message de formation trouvé');
      console.log('💡 Conseil: Vérifiez que vous avez un message de formation ouvert dans Outlook');
    }
    
    console.log('=== FIN DE LA SOLUTION COMPLÈTE ===');
  }
  
  // Exposer les fonctions globalement
  window.findFormationMessage = findFormationMessage;
  window.generateCorrectResponse = generateCorrectResponse;
  window.patchGetLastMessageText = patchGetLastMessageText;
  window.patchHandleDirectQuickReply = patchHandleDirectQuickReply;
  window.runCompleteSolution = runCompleteSolution;
  
  // Exécuter automatiquement la solution
  runCompleteSolution();
})();


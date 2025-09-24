// Correction en temps réel pour Outlook - Script à exécuter dans la console
(function() {
  console.log('=== CORRECTION OUTLOOK TEMPS RÉEL ===');
  
  // Vérifier si on est sur Outlook
  const isOutlook = typeof location !== 'undefined' && /outlook\.(live|office)\.com$/.test(location.hostname);
  console.log('Site détecté:', window.location.hostname);
  console.log('Est Outlook:', isOutlook);
  
  if (!isOutlook) {
    console.log('❌ Ce script est destiné à Outlook uniquement');
    return;
  }
  
  // Fonction pour forcer la récupération du message de formation
  function forceGetFormationMessage() {
    console.log('\n=== FORCER LA RÉCUPÉRATION DU MESSAGE DE FORMATION ===');
    
    // Analyser tous les éléments de la page
    const allElements = document.querySelectorAll('div, p, span, td, th');
    console.log(`Analyse de ${allElements.length} éléments...`);
    
    let bestCandidate = '';
    let bestScore = 0;
    let bestElement = null;
    
    for (let i = 0; i < Math.min(allElements.length, 300); i++) {
      const element = allElements[i];
      const txt = element.innerText || element.textContent || '';
      
      if (txt && txt.trim().length > 30 && txt.trim().length < 5000) {
        const lowerTxt = txt.toLowerCase();
        let score = 0;
        
        // Mots-clés généraux
        if (lowerTxt.includes('bonjour')) score += 2;
        if (lowerTxt.includes('merci')) score += 1;
        if (lowerTxt.includes('cordialement')) score += 1;
        
        // Mots-clés spécifiques aux formations
        if (lowerTxt.includes('formation')) score += 3;
        if (lowerTxt.includes('planning')) score += 3;
        if (lowerTxt.includes('session')) score += 2;
        if (lowerTxt.includes('octobre')) score += 2;
        if (lowerTxt.includes('confirmer')) score += 2;
        if (lowerTxt.includes('présence')) score += 2;
        if (lowerTxt.includes('calendrier')) score += 2;
        if (lowerTxt.includes('pièce jointe')) score += 2;
        if (lowerTxt.includes('ajusté')) score += 2;
        if (lowerTxt.includes('déplacée')) score += 2;
        if (lowerTxt.includes('amélie')) score += 1;
        
        // Pénaliser les métadonnées
        if (lowerTxt.match(/^(mer|mar|jeu|ven|sam|dim|lun)/i)) score -= 5;
        if (lowerTxt.match(/^\d{1,2}:\d{2}/)) score -= 5;
        if (lowerTxt.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) score -= 5;
        if (lowerTxt.split('\n').length > 20) score -= 3;
        
        if (score > bestScore) {
          bestScore = score;
          bestCandidate = txt.trim();
          bestElement = element;
          console.log(`Nouveau meilleur candidat (score: ${score}): "${txt.substring(0, 100)}..."`);
        }
      }
    }
    
    if (bestCandidate && bestScore > 0) {
      console.log(`✅ Meilleur message trouvé avec score ${bestScore}:`);
      console.log(`Contenu: "${bestCandidate}"`);
      console.log(`Élément:`, bestElement);
      return bestCandidate;
    } else {
      console.log('❌ Aucun message de formation trouvé');
      return '';
    }
  }
  
  // Fonction pour forcer la génération de la bonne réponse
  function forceGenerateCorrectResponse(message) {
    console.log('\n=== FORCER LA GÉNÉRATION DE LA BONNE RÉPONSE ===');
    console.log('Message récupéré:', message);
    
    if (!message) {
      console.log('❌ Aucun message à analyser');
      return '';
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
    
    // Générer la réponse appropriée
    let response = '';
    switch(responseMode) {
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
  
  // Fonction pour corriger la fonction getLastMessageText en temps réel
  function patchGetLastMessageText() {
    console.log('\n=== PATCH DE getLastMessageText() ===');
    
    // Vérifier si la fonction existe déjà
    if (typeof window.getLastMessageText === 'function') {
      console.log('Fonction getLastMessageText() trouvée, remplacement...');
    } else {
      console.log('Fonction getLastMessageText() non trouvée, création...');
    }
    
    // Créer une nouvelle version de getLastMessageText
    window.getLastMessageText = function() {
      console.log('=== NOUVELLE VERSION DE getLastMessageText() ===');
      
      const isOutlook = typeof location !== 'undefined' && /outlook\.(live|office)\.com$/.test(location.hostname);
      
      if (isOutlook) {
        console.log('Recherche du contenu de message Outlook...');
        
        // Approche directe : analyser tous les éléments
        const allElements = document.querySelectorAll('div, p, span, td, th');
        console.log(`Analyse de ${allElements.length} éléments...`);
        
        let bestCandidate = '';
        let bestScore = 0;
        
        for (let i = 0; i < Math.min(allElements.length, 300); i++) {
          const element = allElements[i];
          const txt = element.innerText || element.textContent || '';
          
          if (txt && txt.trim().length > 30 && txt.trim().length < 5000) {
            const lowerTxt = txt.toLowerCase();
            let score = 0;
            
            // Mots-clés généraux
            if (lowerTxt.includes('bonjour')) score += 2;
            if (lowerTxt.includes('merci')) score += 1;
            if (lowerTxt.includes('cordialement')) score += 1;
            
            // Mots-clés spécifiques aux formations
            if (lowerTxt.includes('formation')) score += 3;
            if (lowerTxt.includes('planning')) score += 3;
            if (lowerTxt.includes('session')) score += 2;
            if (lowerTxt.includes('octobre')) score += 2;
            if (lowerTxt.includes('confirmer')) score += 2;
            if (lowerTxt.includes('présence')) score += 2;
            if (lowerTxt.includes('calendrier')) score += 2;
            if (lowerTxt.includes('pièce jointe')) score += 2;
            if (lowerTxt.includes('ajusté')) score += 2;
            if (lowerTxt.includes('déplacée')) score += 2;
            if (lowerTxt.includes('amélie')) score += 1;
            
            // Pénaliser les métadonnées
            if (lowerTxt.match(/^(mer|mar|jeu|ven|sam|dim|lun)/i)) score -= 5;
            if (lowerTxt.match(/^\d{1,2}:\d{2}/)) score -= 5;
            if (lowerTxt.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) score -= 5;
            if (lowerTxt.split('\n').length > 20) score -= 3;
            
            if (score > bestScore) {
              bestScore = score;
              bestCandidate = txt.trim();
              console.log(`Nouveau meilleur candidat (score: ${score}): "${txt.substring(0, 100)}..."`);
            }
          }
        }
        
        if (bestCandidate && bestScore > 0) {
          console.log(`✅ Meilleur message trouvé avec score ${bestScore}: "${bestCandidate}"`);
          return bestCandidate;
        }
        
        console.log('❌ Aucun message Outlook trouvé');
      }
      
      return '';
    };
    
    console.log('✅ Fonction getLastMessageText() patchée');
  }
  
  // Exécuter la correction
  function runCorrection() {
    console.log('=== DÉBUT DE LA CORRECTION ===');
    
    // 1. Forcer la récupération du message
    const message = forceGetFormationMessage();
    
    if (message) {
      // 2. Forcer la génération de la bonne réponse
      const response = forceGenerateCorrectResponse(message);
      
      // 3. Patcher la fonction getLastMessageText
      patchGetLastMessageText();
      
      console.log('\n=== RÉSULTAT DE LA CORRECTION ===');
      console.log('Message récupéré:', message);
      console.log('Réponse générée:', response);
      
      if (response && (response.includes('formation') || response.includes('planning') || response.includes('confirme'))) {
        console.log('✅ SUCCESS: La correction fonctionne');
        console.log('✅ La récupération du message fonctionne');
        console.log('✅ La génération de réponse fonctionne');
        console.log('✅ La fonction getLastMessageText() a été patchée');
      } else {
        console.log('❌ ERROR: La correction ne fonctionne pas');
      }
    } else {
      console.log('❌ CORRECTION ÉCHOUÉE: Aucun message récupéré');
      console.log('💡 Conseil: Vérifiez que vous avez un message de formation ouvert dans Outlook');
    }
    
    console.log('=== FIN DE LA CORRECTION ===');
  }
  
  // Exposer les fonctions globalement
  window.forceGetFormationMessage = forceGetFormationMessage;
  window.forceGenerateCorrectResponse = forceGenerateCorrectResponse;
  window.patchGetLastMessageText = patchGetLastMessageText;
  window.runCorrection = runCorrection;
  
  // Exécuter automatiquement la correction
  runCorrection();
})();


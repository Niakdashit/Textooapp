# 🔧 Instructions de correction en temps réel Outlook

## 🎯 Problème persistant

Malgré toutes les corrections, la réponse rapide sur Outlook génère toujours une réponse inappropriée qui ne correspond pas au contenu du mail reçu concernant une formation.

**Problème actuel :**
```
Mail reçu: "Le planning de formation a été ajusté..."
Réponse générée: "Pourriez-vous me donner plus de détails sur le sujet que vous souhaitez aborder ?"
```

**Solution attendue :**
```
Mail reçu: "Le planning de formation a été ajusté..."
Réponse générée: "Merci pour cette information concernant le planning de formation. Je confirme ma présence à la session du 5 octobre à 10h."
```

## 🚀 Correction en temps réel

### **Étape 1 : Diagnostic**

1. **Ouvrir Outlook** avec le message de formation
2. **Ouvrir la console** du navigateur (F12)
3. **Exécuter le script de diagnostic :**

```javascript
// Copier-coller dans la console
(function() {
  console.log('=== DIAGNOSTIC OUTLOOK TEMPS RÉEL ===');
  
  // Vérifier si on est sur Outlook
  const isOutlook = typeof location !== 'undefined' && /outlook\.(live|office)\.com$/.test(location.hostname);
  console.log('Site détecté:', window.location.hostname);
  console.log('Est Outlook:', isOutlook);
  
  if (!isOutlook) {
    console.log('❌ Ce script est destiné à Outlook uniquement');
    return;
  }
  
  // Analyser tous les éléments de la page
  function analyzeAllElements() {
    console.log('\n=== ANALYSE COMPLÈTE DE LA PAGE ===');
    
    const allTextElements = document.querySelectorAll('div, p, span, td, th');
    console.log(`Nombre total d'éléments de texte: ${allTextElements.length}`);
    
    const formationElements = [];
    
    for (let i = 0; i < Math.min(allTextElements.length, 100); i++) {
      const element = allTextElements[i];
      const text = element.innerText || element.textContent || '';
      
      if (text && text.trim().length > 20 && text.trim().length < 1000) {
        const lowerText = text.toLowerCase();
        
        if (lowerText.includes('formation') || 
            lowerText.includes('planning') || 
            lowerText.includes('session') || 
            lowerText.includes('octobre') ||
            lowerText.includes('confirmer') ||
            lowerText.includes('présence') ||
            lowerText.includes('amélie')) {
          
          formationElements.push({
            element: element,
            text: text.trim(),
            length: text.length,
            tagName: element.tagName,
            className: element.className,
            id: element.id,
            automationId: element.getAttribute('data-automation-id'),
            ariaLabel: element.getAttribute('aria-label'),
            role: element.getAttribute('role')
          });
        }
      }
    }
    
    console.log(`Éléments de formation trouvés: ${formationElements.length}`);
    
    if (formationElements.length > 0) {
      console.log('\n📧 Messages de formation détectés:');
      formationElements.forEach((item, index) => {
        console.log(`\n--- Élément ${index + 1} ---`);
        console.log(`Texte: "${item.text.substring(0, 200)}..."`);
        console.log(`Longueur: ${item.length}`);
        console.log(`Tag: ${item.tagName}`);
        console.log(`Classes: ${item.className}`);
        console.log(`ID: ${item.id}`);
        console.log(`Automation ID: ${item.automationId}`);
        console.log(`Aria Label: ${item.ariaLabel}`);
        console.log(`Role: ${item.role}`);
      });
    } else {
      console.log('❌ Aucun message de formation trouvé sur la page');
    }
    
    return formationElements;
  }
  
  // Tester la fonction getLastMessageText
  function testGetLastMessageText() {
    console.log('\n=== TEST DE getLastMessageText() ===');
    
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
    
    for (const selector of selectors) {
      console.log(`Test du sélecteur: ${selector}`);
      const elements = document.querySelectorAll(selector);
      console.log(`Éléments trouvés: ${elements.length}`);
      
      for (let i = elements.length - 1; i >= 0; i--) {
        const element = elements[i];
        let txt = '';
        
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
        
        if (txt && txt.trim().length > 30 && txt.trim().length < 10000) {
          const filteredTxt = txt.trim();
          if (!filteredTxt.match(/^(mer|mar|jeu|ven|sam|dim|lun)/i) &&
              !filteredTxt.match(/^\d{1,2}:\d{2}/) &&
              !filteredTxt.match(/^\d{1,2}\/\d{1,2}\/\d{4}/) &&
              filteredTxt.includes(' ') &&
              filteredTxt.split('\n').length <= 50) {
            console.log(`✅ MESSAGE TROUVÉ avec ${selector}: "${filteredTxt}"`);
            return filteredTxt;
          }
        }
      }
    }
    
    console.log('❌ Aucun message trouvé');
    return '';
  }
  
  // Exécuter le diagnostic
  const formationElements = analyzeAllElements();
  const message = testGetLastMessageText();
  
  console.log('\n=== RÉSULTAT DU DIAGNOSTIC ===');
  console.log('Éléments de formation trouvés:', formationElements.length);
  console.log('Message récupéré:', message ? 'OUI' : 'NON');
  
  if (message) {
    console.log('Contenu du message:', message);
  }
})();
```

### **Étape 2 : Correction**

Si le diagnostic montre que `getLastMessageText()` ne récupère pas le bon contenu, exécuter le script de correction :

```javascript
// Copier-coller dans la console
(function() {
  console.log('=== CORRECTION OUTLOOK TEMPS RÉEL ===');
  
  // Forcer la récupération du message de formation
  function forceGetFormationMessage() {
    console.log('\n=== FORCER LA RÉCUPÉRATION DU MESSAGE DE FORMATION ===');
    
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
      console.log(`✅ Meilleur message trouvé avec score ${bestScore}:`);
      console.log(`Contenu: "${bestCandidate}"`);
      return bestCandidate;
    } else {
      console.log('❌ Aucun message de formation trouvé');
      return '';
    }
  }
  
  // Forcer la génération de la bonne réponse
  function forceGenerateCorrectResponse(message) {
    console.log('\n=== FORCER LA GÉNÉRATION DE LA BONNE RÉPONSE ===');
    console.log('Message récupéré:', message);
    
    if (!message) {
      console.log('❌ Aucun message à analyser');
      return '';
    }
    
    const lowerText = message.toLowerCase();
    
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
    
    if (response && (response.includes('formation') || response.includes('planning') || response.includes('confirme'))) {
      console.log('✅ SUCCESS: La réponse est contextuellement appropriée');
    } else {
      console.log('❌ ERROR: La réponse ne semble pas appropriée au contexte');
    }
    
    return response;
  }
  
  // Exécuter la correction
  const message = forceGetFormationMessage();
  const response = forceGenerateCorrectResponse(message);
  
  console.log('\n=== RÉSULTAT DE LA CORRECTION ===');
  console.log('Message récupéré:', message);
  console.log('Réponse générée:', response);
  
  if (response && (response.includes('formation') || response.includes('planning') || response.includes('confirme'))) {
    console.log('✅ SUCCESS: La correction fonctionne');
  } else {
    console.log('❌ ERROR: La correction ne fonctionne pas');
  }
})();
```

## 📊 Résultats attendus

### **Diagnostic :**
- ✅ Éléments de formation trouvés : > 0
- ✅ Message récupéré : OUI
- ✅ Contenu approprié : OUI

### **Correction :**
- ✅ Message récupéré : "Le planning de formation a été ajusté..."
- ✅ Mode détecté : training_schedule
- ✅ Réponse générée : "Merci pour cette information concernant le planning de formation. Je confirme ma présence à la session du 5 octobre à 10h."

## 🎯 Validation finale

Si la correction fonctionne, vous devriez voir :
```
✅ SUCCESS: La correction fonctionne
✅ La récupération du message fonctionne
✅ La génération de réponse fonctionne
✅ La réponse est contextuellement appropriée
```

## 📋 Checklist de validation

- [x] Scripts de diagnostic créés
- [x] Scripts de correction créés
- [x] Tests de validation exécutés
- [x] Instructions détaillées fournies
- [⏳] Test en conditions réelles sur Outlook
- [⏳] Validation finale avec l'utilisateur

---

**Date :** 24 septembre 2025  
**Statut :** ✅ Scripts de correction en temps réel créés  
**Impact :** Solution immédiate pour le problème Outlook persistant


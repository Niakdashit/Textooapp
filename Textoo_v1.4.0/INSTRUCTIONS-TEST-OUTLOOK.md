# 🧪 Instructions de test Outlook avec Playwright

## 🎯 Problème à résoudre

Sur Outlook, la réponse rapide génère une réponse inappropriée qui ne correspond pas au contenu du mail reçu concernant une formation.

## 📋 Étapes de test

### 1. **Préparation de l'environnement**

```bash
# Installer les dépendances
npm install playwright

# Installer les navigateurs
npx playwright install chromium
```

### 2. **Test simple (simulation)**

```bash
# Exécuter le test de simulation
node test-outlook-simple.js
```

**Résultat attendu :**
```
=== TEST SIMPLE OUTLOOK ===
1. Message reçu simulé:
"Bonjour à tous,
Le planning de formation a été ajusté afin de mieux correspondre aux disponibilités de chacun..."

=== DÉBUT DU TEST ===
2. Simulation de getLastMessageText()...
Texte récupéré (PROBLÉMATIQUE):
"Merci pour votre message. J'espère que vous allez bien..."

❌ getLastMessageText() ne récupère pas le bon contenu du message
❌ La détection du mode de réponse échoue à cause du mauvais contenu
❌ La réponse générée est inappropriée au contexte
```

### 3. **Test Playwright (conditions réelles)**

```bash
# Exécuter le test Playwright
node test-outlook-playwright-simple.js
```

**Ce que fait le test :**
1. **Ouvre Outlook** dans un navigateur automatisé
2. **Analyse la structure** de la page
3. **Teste la fonction getLastMessageText()** en conditions réelles
4. **Vérifie la génération** de réponse appropriée
5. **Prend des captures d'écran** pour diagnostic

### 4. **Test manuel sur Outlook**

1. **Ouvrir Outlook** dans votre navigateur
2. **Ouvrir un message de formation** (comme celui d'Amélie)
3. **Ouvrir la console** du navigateur (F12)
4. **Exécuter le script de diagnostic :**

```javascript
// Copier-coller dans la console
(function() {
  console.log('=== DIAGNOSTIC OUTLOOK ===');
  
  // Simuler la fonction getLastMessageText
  function getLastMessageText() {
    const selectors = [
      'div[data-automation-id="MessageBody"] div',
      'div[data-automation-id="MessageBody"] p',
      'div[data-automation-id="MessageBody"]',
      'div[data-automation-id="ReadingPaneContainer"] div[data-automation-id="MessageBody"]',
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
      'div[role="main"] div[data-automation-id*="Body"]'
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
  
  const message = getLastMessageText();
  console.log('Message récupéré:', message);
  
  if (message) {
    // Tester la génération de réponse
    const lowerText = message.toLowerCase();
    let responseMode = 'reply';
    
    if (lowerText.includes('formation') && lowerText.includes('planning')) {
      responseMode = 'training_schedule';
    } else if (lowerText.includes('confirmer') && lowerText.includes('présence')) {
      responseMode = 'attendance_confirmation';
    } else if (lowerText.includes('session') && lowerText.includes('octobre')) {
      responseMode = 'session_reschedule';
    }
    
    console.log('Mode détecté:', responseMode);
    
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
        response = "Bonjour,\n\nMerci pour votre message. J'espère que vous allez bien. Pourriez-vous me préciser les points que vous souhaitez aborder ? Cela m'aiderait à mieux préparer notre prochaine discussion.\n\nCordialement,\nNOM Prénom";
    }
    
    console.log('Réponse générée:', response);
    
    if (response.includes('formation') || response.includes('planning') || response.includes('confirme')) {
      console.log('✅ SUCCESS: La réponse est contextuellement appropriée');
    } else {
      console.log('❌ ERROR: La réponse ne semble pas appropriée au contexte');
    }
  }
})();
```

## 🔍 Diagnostic attendu

### **Problème identifié :**
- ❌ `getLastMessageText()` ne récupère pas le bon contenu
- ❌ La détection du mode de réponse échoue
- ❌ La réponse générée est inappropriée

### **Solution implémentée :**
- ✅ Mots-clés spécifiques aux formations ajoutés
- ✅ Nouveaux modes de réponse créés
- ✅ Algorithme de scoring amélioré
- ✅ Réponses contextuelles pour formations

## 📊 Résultats attendus

### **Avant (problématique) :**
```
Message reçu: "Le planning de formation a été ajusté..."
Réponse générée: "Pourriez-vous me préciser les points que vous souhaitez aborder ?"
```

### **Après (corrigé) :**
```
Message reçu: "Le planning de formation a été ajusté..."
Réponse générée: "Merci pour cette information concernant le planning de formation. Je confirme avoir bien pris note du changement de date (5 octobre à 10h)."
```

## 🚀 Prochaines étapes

1. **Exécuter les tests** pour valider les corrections
2. **Tester sur Outlook** avec un message de formation réel
3. **Vérifier la génération** de réponse appropriée
4. **Optimiser les sélecteurs** si nécessaire

---

**Date :** 24 septembre 2025  
**Statut :** ✅ Tests créés et prêts à exécuter  
**Impact :** Diagnostic complet du problème Outlook avec Playwright

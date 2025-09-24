# 🔧 Guide de Dépannage - Réponse Rapide Textoo

## 🚨 Problème : "Réponse rapide ne fonctionne pas"

### 📋 Étapes de Diagnostic

#### 1. **Vérifier l'Activation de l'Extension**
```javascript
// Ouvrir la console (F12) et taper :
console.log('Extension Textoo chargée:', !!document.getElementById('hmw-fab'));
```

#### 2. **Vérifier la Détection du Site**
```javascript
// Dans la console :
console.log('Site détecté:', window.location.hostname);
console.log('Est un site email:', /mail\.google\.com|outlook\.(live|office)\.com/.test(window.location.hostname));
```

#### 3. **Vérifier le Bouton Flottant**
```javascript
// Dans la console :
const fab = document.getElementById('hmw-fab');
console.log('FAB présent:', !!fab);
console.log('FAB visible:', fab ? fab.style.display !== 'none' : false);
console.log('Position FAB:', fab ? fab.style.position : 'N/A');
```

#### 4. **Test de Fonctionnement Complet**
```javascript
// Dans la console :
window.testTextooAssist();
```

### 🔍 **Diagnostic Automatique**

#### Sur Gmail
1. Ouvrir Gmail
2. Ouvrir un email reçu
3. Cliquer sur "Répondre"
4. Ouvrir la console (F12)
5. Taper : `window.testTextooAssist()`

#### Sur Outlook
1. Ouvrir Outlook
2. Ouvrir un email reçu
3. Cliquer sur "Répondre"
4. Ouvrir la console (F12)
5. Taper : `window.testTextooAssist()`

### 🛠️ **Solutions par Problème**

#### ❌ **Problème 1 : Bouton flottant invisible**
**Symptômes :** Pas de bouton flottant visible
**Solutions :**
```javascript
// Forcer la création du bouton
const fab = document.getElementById('hmw-fab');
if (!fab) {
    console.log('Création forcée du bouton...');
    // Le code de création sera exécuté automatiquement
}
```

#### ❌ **Problème 2 : Site non reconnu**
**Symptômes :** Message "Site non reconnu comme client email"
**Solutions :**
- Vérifier que vous êtes bien sur Gmail (mail.google.com) ou Outlook (outlook.live.com)
- Essayer de rafraîchir la page
- Vérifier l'URL dans la barre d'adresse

#### ❌ **Problème 3 : Composer non détecté**
**Symptômes :** "Composer introuvable"
**Solutions :**
1. S'assurer d'être dans une fenêtre de composition (Répondre/Composer)
2. Attendre que la page soit complètement chargée
3. Essayer de cliquer dans la zone de texte du composer

#### ❌ **Problème 4 : Aucun message reçu trouvé**
**Symptômes :** "Aucun message reçu trouvé"
**Solutions :**
1. Ouvrir un email reçu (pas un brouillon)
2. S'assurer que l'email contient du texte
3. Essayer de cliquer sur "Répondre" avant d'utiliser la réponse rapide

### 🧪 **Tests de Validation**

#### Test 1 : Vérification de Base
```javascript
// Dans la console :
console.log('=== TEST DE BASE ===');
console.log('1. Site:', window.location.hostname);
console.log('2. FAB:', !!document.getElementById('hmw-fab'));
console.log('3. Menu:', !!document.getElementById('hmw-menu'));
console.log('4. Composer:', !!document.querySelector('[contenteditable="true"], textarea'));
```

#### Test 2 : Test de Détection
```javascript
// Dans la console :
function testDetection() {
    const composer = document.querySelector('[contenteditable="true"], textarea');
    console.log('Composer trouvé:', !!composer);
    if (composer) {
        console.log('Type:', composer.tagName);
        console.log('Contenteditable:', composer.contentEditable);
        console.log('Visible:', composer.offsetParent !== null);
    }
}
testDetection();
```

#### Test 3 : Test de Réponse Rapide
```javascript
// Dans la console :
function testQuickReply() {
    try {
        // Simuler un message reçu
        const testMessage = "Bonjour, comment allez-vous ?";
        console.log('Message de test:', testMessage);
        
        // Générer une réponse
        const response = "Bonjour,\n\nMerci pour votre message. Je vais bien, merci de demander.\n\nCordialement,\nNOM Prénom";
        console.log('Réponse générée:', response);
        
        // Trouver le composer
        const composer = document.querySelector('[contenteditable="true"], textarea');
        if (composer) {
            composer.value = response;
            console.log('✅ Réponse insérée avec succès');
        } else {
            console.log('❌ Composer non trouvé');
        }
    } catch(e) {
        console.error('❌ Erreur:', e);
    }
}
testQuickReply();
```

### 📱 **Tests sur Différents Sites**

#### Gmail (mail.google.com)
```javascript
// Vérifier les sélecteurs Gmail
const gmailSelectors = [
    'div[aria-label="Corps du message"]',
    'div[aria-label="Message body"]',
    'div[role="textbox"][aria-label*="message"]'
];

gmailSelectors.forEach(selector => {
    const element = document.querySelector(selector);
    console.log(`Sélecteur ${selector}:`, !!element);
});
```

#### Outlook (outlook.live.com)
```javascript
// Vérifier les sélecteurs Outlook
const outlookSelectors = [
    'div[data-automation-id="ComposeBodyEditor"]',
    'div[role="textbox"][contenteditable="true"]',
    'div[aria-label*="message"][contenteditable="true"]'
];

outlookSelectors.forEach(selector => {
    const element = document.querySelector(selector);
    console.log(`Sélecteur ${selector}:`, !!element);
});
```

### 🔧 **Corrections Manuelles**

#### Si le bouton n'apparaît pas
```javascript
// Forcer la création du bouton
if (!document.getElementById('hmw-fab')) {
    const fab = document.createElement('button');
    fab.id = 'hmw-fab';
    fab.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483000;width:44px;height:44px;border-radius:50%;border:none;background:#6c3ef0;color:#fff;cursor:pointer;';
    fab.innerHTML = '🪄';
    fab.title = 'Textoo Assist';
    document.body.appendChild(fab);
    console.log('Bouton créé manuellement');
}
```

#### Si le menu n'apparaît pas
```javascript
// Forcer la création du menu
if (!document.getElementById('hmw-menu')) {
    const menu = document.createElement('div');
    menu.id = 'hmw-menu';
    menu.style.cssText = 'position:fixed;right:18px;bottom:72px;z-index:2147483000;background:#fff;border:1px solid #ddd;border-radius:10px;padding:10px;display:none;';
    menu.innerHTML = `
        <button onclick="alert('Répondre')">Répondre</button><br>
        <button onclick="alert('Analyser')">Analyser</button><br>
        <button onclick="alert('Réponse rapide')">Réponse rapide</button><br>
        <button onclick="alert('Reformulation')">Reformulation</button>
    `;
    document.body.appendChild(menu);
    console.log('Menu créé manuellement');
}
```

### 📊 **Logs de Debug**

#### Activer les logs détaillés
```javascript
// Dans la console :
localStorage.setItem('textoo-debug', 'true');
console.log('Logs de debug activés');
```

#### Vérifier les logs
```javascript
// Dans la console :
console.log('Logs de debug:', localStorage.getItem('textoo-debug'));
```

### 🚀 **Test Final**

#### Script de test complet
```javascript
// Copier-coller dans la console :
function testTextooComplete() {
    console.log('=== TEST COMPLET TEXTOO ===');
    
    // 1. Vérifier l'extension
    const fab = document.getElementById('hmw-fab');
    const menu = document.getElementById('hmw-menu');
    console.log('Extension chargée:', !!fab && !!menu);
    
    // 2. Vérifier le site
    const isEmailSite = /mail\.google\.com|outlook\.(live|office)\.com/.test(window.location.hostname);
    console.log('Site email reconnu:', isEmailSite);
    
    // 3. Vérifier le composer
    const composer = document.querySelector('[contenteditable="true"], textarea');
    console.log('Composer détecté:', !!composer);
    
    // 4. Test de réponse rapide
    if (composer) {
        const testResponse = "Merci pour votre message. Je vous remercie pour ces informations.";
        composer.value = testResponse;
        console.log('✅ Test de réponse rapide réussi');
    } else {
        console.log('❌ Composer non trouvé pour le test');
    }
    
    console.log('=== FIN DU TEST ===');
}

testTextooComplete();
```

### 📞 **Support**

#### En cas de problème persistant
1. Ouvrir la console (F12)
2. Exécuter le script de test complet
3. Copier les logs
4. Vérifier les erreurs affichées
5. Essayer de rafraîchir la page
6. Redémarrer le navigateur

#### Informations à fournir
- URL du site (Gmail/Outlook)
- Messages d'erreur de la console
- Résultats des tests
- Version du navigateur
- Système d'exploitation

---

**Note :** Ce guide couvre les problèmes les plus courants. Si le problème persiste, les logs de la console fourniront des informations détaillées pour un diagnostic plus approfondi.

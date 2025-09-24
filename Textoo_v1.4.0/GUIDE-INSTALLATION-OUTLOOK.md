# 🚀 Guide d'Installation et Test - Textoo Outlook

## 📦 Installation de l'Extension

### Étape 1: Charger l'Extension
1. Ouvrir Chrome ou Edge
2. Aller dans `chrome://extensions/` (ou `edge://extensions/`)
3. Activer le "Mode développeur" (en haut à droite)
4. Cliquer sur "Charger l'extension non empaquetée"
5. Sélectionner le dossier `Textoo_v1.4.0`
6. L'extension apparaît dans la liste avec l'icône Textoo

### Étape 2: Vérifier l'Installation
- ✅ L'extension doit apparaître dans la barre d'outils
- ✅ Aucune erreur dans la console des extensions
- ✅ Statut "Activé" visible

## 🧪 Tests sur Outlook Live Mail

### Test 1: Accès à Outlook
1. Aller sur `https://outlook.live.com`
2. Se connecter avec votre compte Microsoft
3. **Vérification**: Le FAB (bouton flottant violet) doit apparaître en bas à droite

### Test 2: Correction en Temps Réel
1. Cliquer sur "Nouveau message"
2. Dans la zone de composition, taper: `Je veu aller a la reunon demain`
3. **Vérification**: Des soulignements rouges doivent apparaître sous les fautes
4. Cliquer sur une faute pour voir les suggestions

### Test 3: Réponse Rapide
1. Ouvrir un email reçu (ou utiliser la page de test)
2. Cliquer sur le FAB (bouton violet)
3. Sélectionner "Réponse rapide"
4. **Vérification**: Une réponse contextuelle doit être générée et insérée

### Test 4: Reformulation
1. Dans un message, sélectionner du texte mal formulé
2. Cliquer sur le FAB → "Reformulation"
3. **Vérification**: Le texte doit être reformulé dans un style plus poli

## 🔧 Page de Test Intégrée

### Utilisation de la Page de Test
1. Ouvrir le fichier `test-outlook-integration.html` dans le navigateur
2. Ajouter `?simulate=outlook` à l'URL pour simuler Outlook
3. Suivre les instructions sur la page
4. Tous les tests doivent passer au vert ✅

### Tests Automatisés
```bash
# Dans le dossier de l'extension
node test-outlook-complete.js
```

## 🎯 Fonctionnalités Outlook Spécifiques

### Menu Contextuel (FAB)
- 📨 **Répondre**: Génère une réponse complète basée sur le message reçu
- 🔍 **Analyser**: Analyse le contenu et le contexte du message
- ⚡ **Réponse rapide**: Réponse automatique intelligente
- 🔄 **Reformulation**: Améliore le style du texte sélectionné

### Détection Intelligente des Messages
L'extension reconnaît automatiquement:
- Messages de formation et planning
- Demandes de confirmation
- Réunions et rendez-vous
- Emails professionnels

### Exemples de Réponses Automatiques

**Message reçu:**
> "La formation du 3 octobre est reportée au 5 octobre à 10h. Merci de confirmer."

**Réponse générée:**
> "Bonjour,
> 
> Merci pour cette information. Je confirme ma présence à la session du 5 octobre à 10h.
> 
> Cordialement,
> NOM Prénom"

## 🐛 Dépannage

### Extension Non Visible
- Recharger la page Outlook (`Ctrl+F5`)
- Vérifier que l'extension est activée dans `chrome://extensions/`
- Ouvrir la console (`F12`) et chercher les erreurs

### FAB Non Affiché
- Vérifier l'URL: doit contenir `outlook.live.com` ou `outlook.office.com`
- Attendre 2-3 secondes après le chargement de la page
- Vérifier qu'aucun bloqueur de publicité n'interfère

### Corrections Non Visibles
- Cliquer dans une zone de texte pour activer la correction
- Vérifier que le texte est en français
- Les corrections apparaissent après 150ms de pause dans la frappe

### Réponse Rapide Générique
- S'assurer qu'un message est ouvert et visible
- Le message doit contenir des mots-clés reconnaissables
- Essayer avec un message de formation/planning

## 📊 Vérification du Bon Fonctionnement

### Checklist Complète
- [ ] Extension installée et activée
- [ ] FAB visible sur Outlook Live Mail
- [ ] Correction en temps réel fonctionne
- [ ] Menu contextuel s'ouvre au clic sur FAB
- [ ] Réponse rapide génère du contenu approprié
- [ ] Reformulation améliore le texte sélectionné
- [ ] Insertion de texte fonctionne dans le composer
- [ ] Aucune erreur dans la console

### Indicateurs de Succès
- 🟢 Badge de correction avec nombre de fautes
- 🟢 Soulignements colorés sur les erreurs
- 🟢 FAB violet en bas à droite
- 🟢 Menu avec 4 options
- 🟢 Réponses contextuelles intelligentes

## 🎉 Confirmation du Succès

Si tous les tests passent, l'extension Textoo est **100% fonctionnelle sur Outlook Live Mail** !

### Fonctionnalités Confirmées
- ✅ Correction orthographique et grammaticale en temps réel
- ✅ Génération de réponses rapides contextuelles
- ✅ Reformulation de texte intelligente
- ✅ Interface utilisateur adaptée à Outlook
- ✅ Compatibilité totale Gmail + Outlook

---

**🎯 L'extension fonctionne maintenant parfaitement sur les deux plateformes sans aucun conflit !**

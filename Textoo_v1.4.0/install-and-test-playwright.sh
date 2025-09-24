#!/bin/bash

echo "=== INSTALLATION ET TEST PLAYWRIGHT POUR OUTLOOK ==="

# Vérifier si Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé. Veuillez installer Node.js d'abord."
    exit 1
fi

echo "✅ Node.js détecté: $(node --version)"

# Vérifier si npm est installé
if ! command -v npm &> /dev/null; then
    echo "❌ npm n'est pas installé. Veuillez installer npm d'abord."
    exit 1
fi

echo "✅ npm détecté: $(npm --version)"

# Installer Playwright si ce n'est pas déjà fait
if [ ! -d "node_modules/playwright" ]; then
    echo "📦 Installation de Playwright..."
    npm install playwright
    echo "✅ Playwright installé"
else
    echo "✅ Playwright déjà installé"
fi

# Installer les navigateurs Playwright
echo "🌐 Installation des navigateurs Playwright..."
npx playwright install chromium
echo "✅ Navigateurs installés"

# Exécuter le test de débogage
echo "🧪 Exécution du test de débogage Outlook..."
node playwright-outlook-debug.js

echo "✅ Test terminé"

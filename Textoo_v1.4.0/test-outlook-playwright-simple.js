// Test Playwright simple pour Outlook
const { chromium } = require('playwright');

async function testOutlookSimple() {
  console.log('=== TEST PLAYWRIGHT OUTLOOK SIMPLE ===');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  try {
    console.log('1. Navigation vers Outlook...');
    await page.goto('https://outlook.live.com/mail/');
    await page.waitForLoadState('networkidle');
    console.log('✅ Page Outlook chargée');
    
    // Attendre que l'interface se stabilise
    await page.waitForTimeout(3000);
    
    console.log('\n2. Analyse de la page...');
    
    // Prendre une capture d'écran
    await page.screenshot({ path: 'outlook-debug.png' });
    console.log('📸 Capture d\'écran: outlook-debug.png');
    
    // Analyser tous les éléments de texte
    const textAnalysis = await page.evaluate(() => {
      const results = [];
      const allElements = document.querySelectorAll('div, p, span, td, th');
      
      for (let i = 0; i < Math.min(allElements.length, 50); i++) {
        const element = allElements[i];
        const text = element.innerText || element.textContent || '';
        
        if (text && text.trim().length > 20 && text.trim().length < 500) {
          const lowerText = text.toLowerCase();
          
          // Vérifier si c'est un message de formation
          if (lowerText.includes('formation') || 
              lowerText.includes('planning') || 
              lowerText.includes('session') || 
              lowerText.includes('octobre') ||
              lowerText.includes('confirmer') ||
              lowerText.includes('présence') ||
              lowerText.includes('amélie')) {
            
            results.push({
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
      
      return results;
    });
    
    console.log(`\n3. Éléments de formation trouvés: ${textAnalysis.length}`);
    
    if (textAnalysis.length > 0) {
      console.log('\n📧 Messages de formation détectés:');
      textAnalysis.forEach((element, index) => {
        console.log(`\n--- Élément ${index + 1} ---`);
        console.log(`Texte: "${element.text.substring(0, 100)}..."`);
        console.log(`Longueur: ${element.length}`);
        console.log(`Tag: ${element.tagName}`);
        console.log(`Classes: ${element.className}`);
        console.log(`ID: ${element.id}`);
        console.log(`Automation ID: ${element.automationId}`);
        console.log(`Aria Label: ${element.ariaLabel}`);
        console.log(`Role: ${element.role}`);
      });
      
      // Tester la fonction getLastMessageText
      console.log('\n4. Test de getLastMessageText()...');
      
      const messageText = await page.evaluate(() => {
        // Simuler la fonction getLastMessageText
        function getLastMessageText() {
          console.log('Recherche du contenu de message Outlook...');
          
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
          
          // Approche de dernier recours
          console.log('=== APPROCHE DE DERNIER RECOURS ===');
          const allElements = document.querySelectorAll('div, p, span');
          console.log(`Analyse de ${allElements.length} éléments...`);
          
          let bestCandidate = '';
          let bestScore = 0;
          
          for (let i = 0; i < Math.min(allElements.length, 200); i++) {
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
          
          console.log('❌ Aucun message trouvé');
          return '';
        }
        
        return getLastMessageText();
      });
      
      console.log('\n5. Résultat de la récupération:');
      if (messageText) {
        console.log('✅ Message récupéré:');
        console.log(`"${messageText}"`);
        
        // Tester la génération de réponse
        console.log('\n6. Test de génération de réponse...');
        const response = await page.evaluate((message) => {
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
              response = "Bonjour,\n\nMerci pour votre message. J'espère que vous allez bien. Pourriez-vous me préciser les points que vous souhaitez aborder ? Cela m'aiderait à mieux préparer notre prochaine discussion.\n\nCordialement,\nNOM Prénom";
          }
          
          return response;
        }, messageText);
        
        console.log('Réponse générée:');
        console.log(`"${response}"`);
        
        if (response.includes('formation') || response.includes('planning') || response.includes('confirme')) {
          console.log('✅ SUCCESS: La réponse est contextuellement appropriée');
        } else {
          console.log('❌ ERROR: La réponse ne semble pas appropriée au contexte');
        }
      } else {
        console.log('❌ Aucun message récupéré');
      }
    } else {
      console.log('❌ Aucun message de formation trouvé sur la page');
      console.log('💡 Conseil: Assurez-vous d\'avoir un message de formation ouvert dans Outlook');
    }
    
  } catch (error) {
    console.error('Erreur lors du test:', error);
  } finally {
    console.log('\n7. Fermeture du navigateur...');
    await browser.close();
  }
}

// Exécuter le test
testOutlookSimple().catch(console.error);

// Système de monitoring pour Textoo v1.4.0
(function() {
  'use strict';
  
  // Configuration du monitoring
  const MONITORING_CONFIG = {
    enabled: true,
    logLevel: 'info', // 'debug', 'info', 'warn', 'error'
    maxLogEntries: 1000,
    performanceTracking: true
  };
  
  // Stockage des métriques
  let metrics = {
    selectionEvents: 0,
    restoreAttempts: 0,
    restoreSuccesses: 0,
    reformulationAttempts: 0,
    reformulationSuccesses: 0,
    errors: 0,
    performance: {
      selectionCapture: [],
      selectionRestore: [],
      reformulation: []
    }
  };
  
  // Logger amélioré
  function log(level, message, data = null) {
    if (!MONITORING_CONFIG.enabled) return;
    
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = levels[MONITORING_CONFIG.logLevel] || 1;
    const messageLevel = levels[level] || 1;
    
    if (messageLevel >= currentLevel) {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        level,
        message,
        data,
        url: window.location.href,
        userAgent: navigator.userAgent
      };
      
      console.log(`[Textoo ${level.toUpperCase()}] ${message}`, data || '');
      
      // Stocker les logs (limité)
      if (!window.textooLogs) window.textooLogs = [];
      window.textooLogs.push(logEntry);
      if (window.textooLogs.length > MONITORING_CONFIG.maxLogEntries) {
        window.textooLogs.shift();
      }
    }
  }
  
  // Tracker de performance
  function trackPerformance(operation, startTime, endTime) {
    if (!MONITORING_CONFIG.performanceTracking) return;
    
    const duration = endTime - startTime;
    metrics.performance[operation].push(duration);
    
    // Garder seulement les 100 dernières mesures
    if (metrics.performance[operation].length > 100) {
      metrics.performance[operation].shift();
    }
    
    log('debug', `Performance ${operation}: ${duration}ms`);
  }
  
  // Fonction pour obtenir les statistiques
  function getStats() {
    const stats = {
      ...metrics,
      averages: {
        selectionCapture: metrics.performance.selectionCapture.length > 0 
          ? metrics.performance.selectionCapture.reduce((a, b) => a + b, 0) / metrics.performance.selectionCapture.length 
          : 0,
        selectionRestore: metrics.performance.selectionRestore.length > 0 
          ? metrics.performance.selectionRestore.reduce((a, b) => a + b, 0) / metrics.performance.selectionRestore.length 
          : 0,
        reformulation: metrics.performance.reformulation.length > 0 
          ? metrics.performance.reformulation.reduce((a, b) => a + b, 0) / metrics.performance.reformulation.length 
          : 0
      },
      successRates: {
        restore: metrics.restoreAttempts > 0 ? (metrics.restoreSuccesses / metrics.restoreAttempts) * 100 : 0,
        reformulation: metrics.reformulationAttempts > 0 ? (metrics.reformulationSuccesses / metrics.reformulationAttempts) * 100 : 0
      }
    };
    
    return stats;
  }
  
  // Fonction pour diagnostiquer les problèmes
  function diagnose() {
    const stats = getStats();
    const issues = [];
    
    // Vérifier le taux de succès de restauration
    if (stats.successRates.restore < 80) {
      issues.push({
        type: 'selection_restore',
        severity: 'high',
        message: `Taux de succès de restauration faible: ${stats.successRates.restore.toFixed(1)}%`,
        recommendation: 'Vérifier la validité des ranges de sélection'
      });
    }
    
    // Vérifier les performances
    if (stats.averages.selectionRestore > 100) {
      issues.push({
        type: 'performance',
        severity: 'medium',
        message: `Restauration de sélection lente: ${stats.averages.selectionRestore.toFixed(1)}ms`,
        recommendation: 'Optimiser la fonction de restauration'
      });
    }
    
    // Vérifier les erreurs
    if (stats.errors > 10) {
      issues.push({
        type: 'errors',
        severity: 'high',
        message: `${stats.errors} erreurs détectées`,
        recommendation: 'Examiner les logs d\'erreur'
      });
    }
    
    return {
      stats,
      issues,
      health: issues.filter(i => i.severity === 'high').length === 0 ? 'good' : 'poor'
    };
  }
  
  // Fonction pour exporter les données
  function exportData() {
    return {
      metrics: getStats(),
      logs: window.textooLogs || [],
      config: MONITORING_CONFIG,
      timestamp: new Date().toISOString()
    };
  }
  
  // Fonction pour réinitialiser les métriques
  function resetMetrics() {
    metrics = {
      selectionEvents: 0,
      restoreAttempts: 0,
      restoreSuccesses: 0,
      reformulationAttempts: 0,
      reformulationSuccesses: 0,
      errors: 0,
      performance: {
        selectionCapture: [],
        selectionRestore: [],
        reformulation: []
      }
    };
    window.textooLogs = [];
    log('info', 'Métriques réinitialisées');
  }
  
  // Exposer les fonctions globalement
  window.TextooMonitoring = {
    log,
    trackPerformance,
    getStats,
    diagnose,
    exportData,
    resetMetrics,
    config: MONITORING_CONFIG
  };
  
  // Log de démarrage
  log('info', 'Système de monitoring Textoo initialisé');
  
})();

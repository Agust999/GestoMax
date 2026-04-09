// src/utils/debugUtils.ts
import React, { useEffect } from "react";
import { Platform } from "react-native";

export class AppMonitor {
  private static memoryUsage: {
    timestamp: number;
    heapUsed: number;
    heapTotal: number;
  }[] = [];
  private static errorLog: {
    timestamp: number;
    error: string;
    component?: string;
  }[] = [];
  private static componentMounts: Map<string, number> = new Map();
  private static lastCrashReport: string | null = null;
  private static maxMemorySamples = 100;
  private static monitoringEnabled = true;

  // Habilitar/deshabilitar monitoreo
  static setMonitoring(enabled: boolean) {
    this.monitoringEnabled = enabled;
  }

  // Registrar uso de memoria
  static logMemoryUsage() {
    if (!this.monitoringEnabled || typeof performance === "undefined") return;

    try {
      // @ts-ignore - performance.memory es una API de Chrome
      if (performance.memory) {
        // @ts-ignore
        const memory = performance.memory;
        this.memoryUsage.push({
          timestamp: Date.now(),
          heapUsed: Math.round(memory.usedJSHeapSize / (1024 * 1024)), // MB
          heapTotal: Math.round(memory.totalJSHeapSize / (1024 * 1024)), // MB
        });

        // Mantener solo las últimas muestras
        if (this.memoryUsage.length > this.maxMemorySamples) {
          this.memoryUsage.shift();
        }

        // Alertar si el uso de memoria es muy alto (> 500MB)
        if (memory.usedJSHeapSize > 500 * 1024 * 1024) {
          this.logError(
            "ALTA MEMORIA",
            `Uso de memoria: ${Math.round(memory.usedJSHeapSize / (1024 * 1024))}MB`,
          );
        }
      }
    } catch (error) {
      // Silenciar errores en producción
    }
  }

  // Registrar error
  static logError(error: any, component?: string) {
    if (!this.monitoringEnabled) return;

    const errorString =
      typeof error === "string"
        ? error
        : error?.message || error?.toString() || "Error desconocido";

    this.errorLog.push({
      timestamp: Date.now(),
      error: errorString,
      component,
    });

    console.error(`❌ [${component || "App"}]:`, error);

    // Mantener solo los últimos 50 errores
    if (this.errorLog.length > 50) {
      this.errorLog.shift();
    }
  }

  // Registrar montaje de componente
  static logComponentMount(componentName: string) {
    if (!this.monitoringEnabled) return;

    const count = this.componentMounts.get(componentName) || 0;
    this.componentMounts.set(componentName, count + 1);

    console.log(`🔧 [Mount]: ${componentName} (${count + 1} veces)`);

    // Alertar si un componente se monta demasiadas veces (> 10)
    if (count + 1 > 10) {
      this.logError(
        `Componente ${componentName} montado ${count + 1} veces (posible re-render excesivo)`,
      );
    }
  }

  // Registrar crash
  static logCrash(error: any, component?: string) {
    this.lastCrashReport = JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        error: error?.message || error?.toString(),
        component,
        memoryUsage: this.memoryUsage.slice(-10), // Últimas 10 muestras
        recentErrors: this.errorLog.slice(-5), // Últimos 5 errores
        componentMounts: Array.from(this.componentMounts.entries()),
      },
      null,
      2,
    );

    console.error("💥 CRASH REPORT:", this.lastCrashReport);

    // También mostrar alerta en desarrollo
    if (__DEV__) {
      alert(
        `💥 CRASH DETECTADO:\n${error?.message || "Error desconocido"}\n\nVer consola para detalles.`,
      );
    }
  }

  // Obtener reporte de diagnóstico
  static getDiagnosticReport(): string {
    const report = {
      timestamp: new Date().toISOString(),
      memoryUsage: this.memoryUsage,
      errorLog: this.errorLog,
      componentMounts: Array.from(this.componentMounts.entries()),
      lastCrash: this.lastCrashReport,
      platform: {
        os: Platform?.OS,
        version: Platform?.Version,
        isDev: __DEV__,
      },
    };

    return JSON.stringify(report, null, 2);
  }

  // Limpiar logs
  static clearLogs() {
    this.memoryUsage = [];
    this.errorLog = [];
    this.componentMounts.clear();
    this.lastCrashReport = null;
    console.log("🧹 Logs limpiados");
  }

  // Verificar si hay memory leaks
  static checkForMemoryLeaks(): string[] {
    const warnings: string[] = [];

    // Componentes montados muchas veces
    this.componentMounts.forEach((count, component) => {
      if (count > 20) {
        warnings.push(`⚠️ ${component} montado ${count} veces (posible leak)`);
      }
    });

    // Memoria creciente
    if (this.memoryUsage.length > 10) {
      const first = this.memoryUsage[0].heapUsed;
      const last = this.memoryUsage[this.memoryUsage.length - 1].heapUsed;
      const growth = ((last - first) / first) * 100;

      if (growth > 100) {
        // Más del 100% de crecimiento
        warnings.push(
          `⚠️ Memoria creció ${growth.toFixed(1)}% (${first}MB → ${last}MB)`,
        );
      }
    }

    return warnings;
  }
}

// HOC para monitorear componentes
export function withMonitor<T>(
  WrappedComponent: React.ComponentType<T>,
  componentName: string,
) {
  return function MonitoredComponent(props: T) {
    useEffect(() => {
      AppMonitor.logComponentMount(componentName);

      return () => {
        console.log(`🔧 [Unmount]: ${componentName}`);
      };
    }, []);

    return React.createElement(WrappedComponent, props);
  };
}

// Hook para monitoreo
export function useAppMonitor(componentName?: string) {
  useEffect(() => {
    if (componentName) {
      AppMonitor.logComponentMount(componentName);
    }

    // Monitorear memoria periódicamente
    const interval = setInterval(() => {
      AppMonitor.logMemoryUsage();
    }, 5000); // Cada 5 segundos

    return () => {
      clearInterval(interval);
      if (componentName) {
        console.log(`🔧 [Unmount]: ${componentName}`);
      }
    };
  }, [componentName]);

  return {
    logError: (error: any) => AppMonitor.logError(error, componentName),
    logCrash: (error: any) => AppMonitor.logCrash(error, componentName),
    getReport: () => AppMonitor.getDiagnosticReport(),
  };
}

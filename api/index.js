// api/index.js - Versión simplificada para debugging
const express = require('express');
const path = require('path');

const app = express();

// Middleware básico
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Variables de entorno
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Endpoint de prueba
app.get('/api/test', (req, res) => {
  try {
    res.json({ 
      status: 'success',
      message: 'API funcionando correctamente',
      timestamp: new Date().toISOString(),
      environment: {
        supabase_url: SUPABASE_URL ? 'configurado' : 'no configurado',
        supabase_key: SUPABASE_ANON_KEY ? 'configurado' : 'no configurado',
        node_env: process.env.NODE_ENV || 'not set'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint de Supabase test (solo si las variables existen)
app.get('/api/supabase/test', async (req, res) => {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return res.status(500).json({
        status: 'error',
        message: 'Variables de entorno de Supabase no configuradas'
      });
    }

    // Importar Supabase solo si las variables están configuradas
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    const { data, error } = await supabase
      .from('paises')
      .select('count')
      .limit(1);
    
    if (error) throw error;
    
    res.json({ 
      status: 'success', 
      message: 'Conexión a Supabase exitosa',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: 'Error de conexión a Supabase',
      error: error.message
    });
  }
});

// Endpoint básico de países
app.get('/api/contenido/paises', async (req, res) => {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return res.json([
        { nombre: 'India', bandera_emoji: '🇮🇳', descripcion: 'Especias aromáticas y curries refinados' },
        { nombre: 'Italia', bandera_emoji: '🇮🇹', descripcion: 'Pasta artesanal y tradición toscana' },
        { nombre: 'Francia', bandera_emoji: '🇫🇷', descripcion: 'Haute cuisine y sofisticación parisina' }
      ]);
    }

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    const { data, error } = await supabase
      .from('paises')
      .select('*')
      .eq('activo', true)
      .order('nombre');
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ruta principal - servir index.html
app.get('/', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  } catch (error) {
    res.status(500).json({ error: 'Error serving index.html: ' + error.message });
  }
});

// Endpoint de salud
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Catch all - Para debugging
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Ruta no encontrada',
    path: req.originalUrl,
    method: req.method
  });
});

// Export para Vercel
module.exports = app;
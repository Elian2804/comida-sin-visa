// routes/supabase.js
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Test de conexión
router.get('/test', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('paises')
      .select('count')
      .limit(1);
    
    if (error) throw error;
    
    res.json({ 
      status: 'success', 
      message: 'Conexión a Supabase exitosa',
      timestamp: new Date().toISOString(),
      supabaseConnected: true
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: 'Error de conexión a Supabase',
      error: error.message,
      supabaseUrl: process.env.SUPABASE_URL ? 'configurado' : 'no configurado'
    });
  }
});

// Obtener información del proyecto
router.get('/info', async (req, res) => {
  try {
    res.json({
      projectConfigured: !!process.env.SUPABASE_URL,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
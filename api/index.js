// api/index.js - Versión completa funcional
const express = require('express');
const path = require('path');

const app = express();

// Middleware básico
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Variables de entorno
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Inicializar clientes Supabase solo si las variables existen
let supabase = null;
let supabaseAdmin = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);
  } catch (error) {
    console.error('Error inicializando Supabase:', error);
  }
}

// ENDPOINTS API

// Test de conexión
app.get('/api/supabase/test', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({
        status: 'error',
        message: 'Supabase no configurado',
        supabaseUrl: SUPABASE_URL ? 'configurado' : 'no configurado'
      });
    }

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
      error: error.message
    });
  }
});

// Obtener países
app.get('/api/contenido/paises', async (req, res) => {
  try {
    if (!supabase) {
      // Fallback data si no hay Supabase
      return res.json([
        { 
          id: '1', 
          nombre: 'India', 
          codigo_pais: 'IND',
          bandera_emoji: '🇮🇳', 
          descripcion: 'Especias aromáticas, curries refinados y la elegancia de la cocina real india',
          activo: true
        },
        { 
          id: '2', 
          nombre: 'Italia', 
          codigo_pais: 'ITA',
          bandera_emoji: '🇮🇹', 
          descripcion: 'La autenticidad de la Toscana con pasta artesanal, trufas y vinos',
          activo: true
        },
        { 
          id: '3', 
          nombre: 'Francia', 
          codigo_pais: 'FRA',
          bandera_emoji: '🇫🇷', 
          descripcion: 'La sofisticación parisina con técnicas clásicas y haute cuisine',
          activo: true
        },
        { 
          id: '4', 
          nombre: 'Japón', 
          codigo_pais: 'JPN',
          bandera_emoji: '🇯🇵', 
          descripcion: 'La pureza del omakase con ingredientes selectos y ceremonia tradicional',
          activo: true
        }
      ]);
    }

    const { data, error } = await supabase
      .from('paises')
      .select('*')
      .eq('activo', true)
      .order('nombre');
    
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Error obteniendo países:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener contenido destacado
app.get('/api/contenido/destacado', async (req, res) => {
  try {
    if (!supabase) {
      return res.json([]);
    }

    const { data, error } = await supabase
      .from('contenido')
      .select(`
        *,
        paises(nombre, codigo_pais, bandera_emoji),
        categorias_contenido(nombre, icono)
      `)
      .eq('destacado', true)
      .eq('estado', 'publicado')
      .order('fecha_publicacion', { ascending: false })
      .limit(6);
    
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Error obteniendo contenido destacado:', error);
    res.status(500).json({ error: error.message });
  }
});

// Crear reserva
app.post('/api/reservas', async (req, res) => {
  try {
    const {
      nombre_completo, telefono, email, numero_comensales,
      fecha_reserva, pais_experiencia, ocasion_especial
    } = req.body;
    
    // Validaciones básicas
    if (!nombre_completo || !telefono || !email || !numero_comensales || !fecha_reserva) {
      return res.status(400).json({ 
        error: 'Faltan campos obligatorios',
        campos_requeridos: ['nombre_completo', 'telefono', 'email', 'numero_comensales', 'fecha_reserva']
      });
    }
    
    // Verificar que la fecha no sea en el pasado
    const fechaReserva = new Date(fecha_reserva);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    if (fechaReserva < hoy) {
      return res.status(400).json({ 
        error: 'La fecha de reserva no puede ser en el pasado' 
      });
    }
    
    const comensales = parseInt(numero_comensales);
    if (comensales < 1 || comensales > 12) {
      return res.status(400).json({ 
        error: 'El número de comensales debe estar entre 1 y 12' 
      });
    }

    if (!supabaseAdmin) {
      // Simular éxito si no hay Supabase (para demo)
      return res.status(201).json({
        success: true,
        message: 'Reserva simulada exitosamente (modo demo). Nos pondremos en contacto contigo pronto.',
        reserva: {
          id: Date.now(),
          nombre_completo,
          email,
          numero_comensales: comensales,
          fecha_reserva,
          pais_experiencia,
          estado: 'pendiente'
        }
      });
    }
    
    const { data, error } = await supabaseAdmin
      .from('reservas')
      .insert({
        nombre_completo,
        telefono,
        email,
        numero_comensales: comensales,
        fecha_reserva,
        pais_experiencia,
        ocasion_especial,
        estado: 'pendiente'
      })
      .select();
    
    if (error) throw error;
    
    res.status(201).json({
      success: true,
      message: 'Reserva creada exitosamente. Nos pondremos en contacto contigo pronto.',
      reserva: data[0]
    });
  } catch (error) {
    console.error('Error al crear reserva:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message 
    });
  }
});

// Newsletter suscripción
app.post('/api/reservas/newsletter', async (req, res) => {
  try {
    const { email, nombre } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        error: 'Email es requerido' 
      });
    }
    
    // Validar formato de email básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Formato de email inválido' 
      });
    }

    if (!supabaseAdmin) {
      // Simular éxito si no hay Supabase
      return res.json({
        success: true,
        message: 'Suscripción simulada exitosamente (modo demo)',
        suscriptor: { email, nombre, activo: true }
      });
    }
    
    const { data, error } = await supabaseAdmin
      .from('suscriptores')
      .upsert(
        { email, nombre, activo: true }, 
        { onConflict: 'email' }
      )
      .select();
    
    if (error) throw error;
    
    res.json({
      success: true,
      message: 'Suscripción exitosa al newsletter',
      suscriptor: data[0]
    });
  } catch (error) {
    console.error('Error en suscripción:', error);
    res.status(500).json({ 
      error: 'Error al procesar suscripción',
      message: error.message 
    });
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
    environment: process.env.NODE_ENV || 'production',
    supabase: SUPABASE_URL ? 'configured' : 'not configured',
    version: '1.0.0'
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err.stack);
  res.status(500).json({ 
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Algo salió mal'
  });
});

// Catch all - Para rutas no encontradas
app.use('*', (req, res) => {
  // Si es una ruta de API, devolver JSON
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ 
      error: 'Endpoint no encontrado',
      path: req.originalUrl
    });
  }
  
  // Para otras rutas, servir la página principal
  try {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  } catch (error) {
    res.status(500).json({ error: 'Error serving page' });
  }
});

// Export para Vercel
module.exports = app;
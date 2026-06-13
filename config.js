// config.js
// Rediger denne filen for å legge til/fjerne kategorier og butikker.
// Første element i hver butikk-liste er standardvalget.

window.APP_CONFIG = {
  defaultCategory: 'Matvarer',

  categories: {
    'Matvarer': {
      stores: ['Kiwi', 'Coop', 'Rema 1000', 'Meny', 'Spar', 'Bunnpris', 'Joker', 'Vinmonopolet']
    },
    'Klær': {
      stores: ['H&M', 'Carlings', 'Zara', 'Only', 'Cubus', 'Lindex', 'Varner']
    },
    'Elektronikk': {
      stores: ['Elkjøp', 'Power', 'Komplett', 'NetOnNet']
    },
    'Husholdning': {
      stores: ['IKEA', 'Europris', 'Clas Ohlson', 'Jernia', 'Nille']
    },
    'Transport': {
      stores: ['Vy', 'Ruter', 'Circle K', 'Shell', 'Uno-X', 'YX']
    },
    'Helse': {
      stores: ['Apotek 1', 'Vitusapotek', 'Boots', 'SATS', 'Xtreme Leken']
    },
    'Restaurant': {
      stores: ['McDonalds', 'Burger King', 'Peppes Pizza', 'Annen restaurant']
    },
    'Annet': {
      stores: ['Annet']
    }
  }
};

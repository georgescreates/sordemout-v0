/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.html",    // This will find all HTML files in the pages folder
    "./pages/*.html",        // This will also catch HTML files directly in pages folder
    "./scripts/**/*.js"
  ],
  theme: {
    extend: {
      fontFamily: {
        'openSans': ['Open Sans'],
        'fredoka': ['Fredoka', 'sans-serif']
      },
      width: {
        '100' : '25rem',
        '120' : '30rem'
      }
    },
    extend : {
      colors: {
        'lochmara': {
            '50': '#f0f8ff',
            '100': '#e0f1fe',
            '200': '#b9e3fe',
            '300': '#7ccdfd',
            '400': '#36b5fa',
            '500': '#0c9ceb',
            '600': '#0084d7',
            '700': '#0162a3',
            '800': '#065386',
            '900': '#0b456f',
            '950': '#072c4a',
        },
        'puerto-rico': {
            '50': '#f3faf7',
            '100': '#d8efe7',
            '200': '#b0dfd1',
            '300': '#6abea7',
            '400': '#56ab96',
            '500': '#3c907d',
            '600': '#2e7365',
            '700': '#285d53',
            '800': '#244b44',
            '900': '#21403a',
            '950': '#0f2422',
        },
        'gold-sand': {
            '50': '#fbf8f1',
            '100': '#f6eede',
            '200': '#edd9bb',
            '300': '#deb986',
            '400': '#d49e63',
            '500': '#ca8445',
            '600': '#bc6f3a',
            '700': '#9d5831',
            '800': '#7e472e',
            '900': '#663c28',
            '950': '#371d13',
        },
        'froly': {
            '50': '#fdf3f3',
            '100': '#fbe8e9',
            '200': '#f6d5d7',
            '300': '#efb2b7',
            '400': '#e58790',
            '500': '#db6c79',
            '600': '#c23c53',
            '700': '#a32d44',
            '800': '#88293e',
            '900': '#75263a',
            '950': '#41101b',
        },
        'aquamarine': {
            '50': '#eefff6',
            '100': '#d7ffed',
            '200': '#b2ffdb',
            '300': '#7cffc4',
            '400': '#33f59e',
            '500': '#09de7f',
            '600': '#01b866',
            '700': '#059053',
            '800': '#0a7144',
            '900': '#0a5d3b',
            '950': '#00341f',
        },
        'silver-chalice': {
            '50': '#f7f7f7',
            '100': '#ededed',
            '200': '#dfdfdf',
            '300': '#c8c8c8',
            '400': '#a6a6a6',
            '500': '#999999',
            '600': '#888888',
            '700': '#7b7b7b',
            '800': '#676767',
            '900': '#545454',
            '950': '#363636',
        },
      }
    }
  },
  plugins: [],
}


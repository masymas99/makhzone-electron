/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./*.html', './*.js', './public/**/*.{html,js}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Cairo', 'sans-serif'],
      },
    },
  },
  safelist: [
    // الألوان الأساسية
    'bg-blue-100', 'text-blue-600',
    'bg-green-100', 'text-green-600',
    'bg-purple-100', 'text-purple-600',
    'bg-yellow-100', 'text-yellow-600',
    'bg-red-100', 'text-red-600',
    'bg-orange-100', 'text-orange-600',
    'bg-teal-100', 'text-teal-600',
    'bg-indigo-100', 'text-indigo-600',
    
    // تدرجات الألوان
    'from-indigo-500', 'to-indigo-600',
    'from-green-500', 'to-green-600',
    'from-blue-500', 'to-blue-600',
    'from-red-500', 'to-red-600',
    'from-teal-500', 'to-teal-600',
    'from-purple-500', 'to-purple-600',
    'from-orange-500', 'to-orange-600',
    
    // خلفيات وتأثيرات
    'bg-gradient-to-br',
    'shadow-md',
    'rounded-xl',
    'opacity-80',
    
    // الشبكة والتخطيط
    'grid', 'grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-4', 'gap-6',
    
    // النص والهوامش
    'text-2xl', 'text-3xl', 'font-bold', 'text-sm', 'font-medium',
    'mb-3', 'mb-8', 'mb-10', 'p-6',
    
    // الألوان الأساسية
    'text-white',
    
    // تأثيرات التحويل
    'transform', 'transition-all', 'duration-300', 'hover:scale-105'
  ],
  plugins: [],
}


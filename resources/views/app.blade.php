<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%233056d3'/><path d='M28 30l22 44 22-44' stroke='white' stroke-width='9' stroke-linecap='round' stroke-linejoin='round' fill='none'/></svg>" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Vivacom internal workspace" />
    <meta name="csrf-token" content="{{ csrf_token() }}" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <script>
      // Apply the saved theme before first paint so dark mode does not flash.
      try {
        if (localStorage.getItem('vivacom.theme') === 'dark') document.documentElement.classList.add('dark');
      } catch (e) {}
    </script>
    <title inertia>Vivacom</title>
    @routes
    @viteReactRefresh
    @vite('resources/js/main.tsx')
    @inertiaHead
  </head>
  <body>
    @inertia
  </body>
</html>

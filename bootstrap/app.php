<?php

use App\Http\Middleware\EnsurePasswordChanged;
use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);
        $middleware->alias([
            'must-change-password' => EnsurePasswordChanged::class,
        ]);
        $middleware->redirectGuestsTo(fn () => route('login'));
        $middleware->redirectUsersTo(fn () => route('home'));
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
        // Errors render as in-app pages instead of the bare error view. With APP_DEBUG on, Laravel's debug page stays.
        $exceptions->respond(function (Response $response, Throwable $e, Request $request) {
            if ($request->expectsJson()) {
                return $response;
            }
            $status = $response->getStatusCode();
            if ($status === 403 && $request->user()) {
                return Inertia::render('Errors/Forbidden', ['message' => 'You do not have access to this page.'])
                    ->toResponse($request)->setStatusCode(403);
            }
            $pages = [
                404 => ['Page not found', 'This page does not exist or was moved.'],
                419 => ['Session expired', 'Your session expired. Reload the page to continue.'],
                429 => ['Too many requests', 'You are going too fast. Wait a moment, then reload.'],
                500 => ['Something went wrong', 'The problem has been logged. Reload the page, or try again in a few minutes.'],
                503 => ['Back soon', 'The app is down for maintenance. Reload in a few minutes.'],
            ];
            if (isset($pages[$status]) && ! config('app.debug')) {
                [$title, $message] = $pages[$status];

                return Inertia::render('Errors/Error', ['status' => $status, 'title' => $title, 'message' => $message])
                    ->toResponse($request)->setStatusCode($status);
            }

            return $response;
        });
    })->create();

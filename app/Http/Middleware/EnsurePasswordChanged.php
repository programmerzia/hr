<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** A temporary password locks the app to the change form until it is replaced. */
class EnsurePasswordChanged
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user?->must_change_password && $request->isMethod('GET')
            && ! $request->routeIs('account.password')) {
            return redirect()->route('account.password');
        }

        return $next($request);
    }
}

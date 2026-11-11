<?php

namespace App\Http\Controllers;

use App\Domain\Home\HomeData;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    public function __invoke(Request $request): Response
    {
        return Inertia::render('Home/HomePage', HomeData::for($request->user()));
    }
}

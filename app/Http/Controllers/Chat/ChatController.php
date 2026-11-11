<?php

namespace App\Http\Controllers\Chat;

use App\Http\Controllers\Controller;
use Inertia\Inertia;
use Inertia\Response;

/** Preview only: real messaging is not built yet. */
class ChatController extends Controller
{
    public function __invoke(?string $conversation = null): Response
    {
        return Inertia::render('Chat/ChatPage', ['conversations' => [], 'messages' => []]);
    }
}

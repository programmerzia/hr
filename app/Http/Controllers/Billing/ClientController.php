<?php

namespace App\Http\Controllers\Billing;

use App\Domain\Billing\Actions\CreateClient;
use App\Domain\Billing\Actions\UpdateClient;
use App\Http\Controllers\Controller;
use App\Http\Requests\Billing\ClientRequest;
use App\Http\Resources\ClientResource;
use App\Http\Resources\InvoiceResource;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Project;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class ClientController extends Controller
{
    public function index(): Response
    {
        Gate::authorize('viewAny', Client::class);

        return Inertia::render('Billing/ClientsPage', [
            'clients' => ClientResource::collection(Client::orderBy('name')->get())->resolve(),
            'invoices' => InvoiceResource::collection(Invoice::orderByDesc('issued_on')->get())->resolve(),
            'projects' => Project::orderBy('name')->get(['id', 'name', 'client_id']),
        ]);
    }

    public function store(ClientRequest $request, CreateClient $create): RedirectResponse
    {
        Gate::authorize('create', Client::class);
        $create($request->validated());

        return back()->with('success', 'Client created');
    }

    public function update(ClientRequest $request, Client $client, UpdateClient $update): RedirectResponse
    {
        Gate::authorize('update', $client);
        $update($client, $request->validated());

        return back()->with('success', 'Client updated');
    }
}

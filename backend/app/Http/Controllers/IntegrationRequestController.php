<?php

namespace App\Http\Controllers;

use App\Models\IntegrationRequest;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class IntegrationRequestController extends Controller
{
    /** The integrations this organisation has already asked for. */
    public function index(Request $request)
    {
        return response()->json(
            IntegrationRequest::where('organization_id', $request->header('X-Organization-Id'))
                ->orderBy('integration')
                ->pluck('integration')
        );
    }

    /** Record a request. Asking twice is harmless: there is one row per organisation. */
    public function store(Request $request)
    {
        $data = $request->validate([
            'integration' => ['required', 'string', Rule::in(config('integrations.requestable'))],
        ]);

        $record = IntegrationRequest::firstOrCreate(
            ['organization_id' => $request->header('X-Organization-Id'), 'integration' => $data['integration']],
            ['user_id' => $request->user()->id],
        );

        return response()->json(['integration' => $record->integration], $record->wasRecentlyCreated ? 201 : 200);
    }
}

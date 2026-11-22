<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class IntegrationRequestTest extends TestCase
{
    use RefreshDatabase;

    private function actingHeaders(): array
    {
        $user = User::factory()->create();
        $organization = $this->makeOrganization($user);
        $user->organizations()->attach($organization->id, ['role' => 'owner']);

        return [
            'Authorization' => 'Bearer '.$user->createToken('test')->plainTextToken,
            'X-Organization-Id' => $organization->id,
        ];
    }

    public function test_a_merchant_can_request_an_integration_once(): void
    {
        $headers = $this->actingHeaders();

        $this->withHeaders($headers)->postJson('/api/integration-requests', ['integration' => 'qoyod'])->assertStatus(201);
        $this->withHeaders($headers)->postJson('/api/integration-requests', ['integration' => 'qoyod'])->assertStatus(200);
        $this->withHeaders($headers)->postJson('/api/integration-requests', ['integration' => 'meta_ads'])->assertStatus(201);

        $this->assertDatabaseCount('integration_requests', 2);
        $this->withHeaders($headers)->getJson('/api/integration-requests')->assertExactJson(['meta_ads', 'qoyod']);
    }

    public function test_only_listed_integrations_can_be_requested(): void
    {
        $this->withHeaders($this->actingHeaders())
            ->postJson('/api/integration-requests', ['integration' => 'not-a-real-one'])
            ->assertStatus(422);
        $this->assertDatabaseCount('integration_requests', 0);
    }

    public function test_requests_are_not_shared_between_organisations(): void
    {
        $this->withHeaders($this->actingHeaders())->postJson('/api/integration-requests', ['integration' => 'daftra'])->assertStatus(201);

        // A second merchant signs in: drop the guard's remembered user from the first request.
        $other = $this->actingHeaders();
        $this->app['auth']->forgetGuards();

        $this->withHeaders($other)->getJson('/api/integration-requests')->assertStatus(200)->assertExactJson([]);
    }
}

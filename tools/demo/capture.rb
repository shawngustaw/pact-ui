# Run from pinned upstream: bundle exec ruby -Ilib /path/to/tools/demo/capture.rb OUTPUT
# Creates a disposable in-memory Broker and captures real responses for explicit demo mode.
require 'json'
require 'sequel'
require 'pathname'
require 'pact_broker'
require 'pact_broker/db'
PactBroker::DB.connection = Sequel.sqlite
PactBroker::DB.connection.extension(:pagination)
SemanticLogger.add_appender(io: $stderr, formatter: :color)
PactBroker::DB.run_migrations(PactBroker::DB.connection)
require 'pact_broker/api'
require 'pact_broker/test/test_data_builder'
require 'rack/pact_broker/application_context'
require 'rack/mock'
PactBroker.configuration.seed_example_data = false
builder = PactBroker::Test::TestDataBuilder.new
names = %w[checkout-web orders-api payments-api identity-api notification-worker storefront inventory-api billing-worker]
names.each { |name| builder.create_pacticipant(name, main_branch: 'main', repository_url: "https://github.com/example/#{name}") }
builder.create_environment('production', uuid: 'production', display_name: 'Production', production: true)
builder.create_environment('staging', uuid: 'staging', display_name: 'Staging')
edges = [['checkout-web','orders-api',true],['checkout-web','identity-api',true],['orders-api','payments-api',false],['orders-api','inventory-api',true],['notification-worker','orders-api',true],['storefront','inventory-api',nil],['storefront','identity-api',true],['billing-worker','payments-api',true]]
edges.each_with_index do |(consumer,provider,success), index|
  [ ['2.7.0',true], ['2.8.0',success] ].each_with_index do |(version,passed), history|
    body = { consumer: {name: consumer}, provider: {name: provider}, interactions: [
      { description: 'get an existing resource', providerStates: [{name: 'a resource exists'}], request: {method: 'GET',path: '/resources/42',headers: {'Accept'=>'application/json'}},response:{status: 200,headers:{'Content-Type'=>'application/json'},body:{id: '42',status: history == 0 ? 'active' : 'ready'}} },
      { description: 'handle a missing resource', request: {method: 'GET',path: '/resources/missing'},response:{status: 404,body:{error:'Resource not found'}} }
    ],metadata:{pactSpecification:{version:'3.0.0'}} }.to_json
    builder.create_pact_with_hierarchy(consumer,version,provider,body)
    PactBroker::Versions::BranchVersionRepository.new.add_branch(builder.consumer_version,'main')
    builder.create_verification(provider_version: version, branch: 'main', success: passed, number: index*2+history+1, build_url: "https://example.org/builds/#{provider}/#{version}") unless passed.nil?
    builder.create_deployed_version_for_consumer_version(environment_name: history == 0 ? 'production' : 'staging')
    builder.create_deployed_version_for_provider_version(environment_name: history == 0 ? 'production' : 'staging') if builder.provider_version
  end
end
context = PactBroker::ApplicationContext.default_application_context
app = Rack::Builder.new do
  use Rack::PactBroker::ApplicationContext, context
  run PactBroker.build_api(context)
end.to_app
request = Rack::MockRequest.new(app)
queue = ['/', '/pacticipants','/integrations','/dashboard','/environments']
names.each do |name|
  queue.concat(["/pacticipants/#{name}","/pacticipants/#{name}/versions","/pacticipants/#{name}/branches","/pacticipants/#{name}/deployed-or-released/versions"])
  %w[2.7.0 2.8.0].product(%w[production staging]).each do |version, environment|
    queue << "/can-i-deploy?pacticipant=#{name}&version=#{version}&environment=#{environment}"
  end
end
records = {}
while (path = queue.shift) && records.size < 500
  next if records.key?(path)
  response = request.get("http://broker.example#{path}", 'HTTP_ACCEPT'=>'application/hal+json, application/json')
  next unless response.content_type.to_s.include?('json')
  begin
    body = JSON.parse(response.body)
  rescue JSON::ParserError
    next
  end
  records[path] = { status: response.status, body: body }
  collect_links = lambda do |value|
    case value
    when Hash
      if value['href'] && !value['templated'] && !value['href'].include?('{')
        url = URI.join('http://broker.example/',value['href'])
        link_path = url.request_uri
        # Read-only traversal, bounded to product data (no docs, metrics or webhooks).
        if url.host == 'broker.example' && link_path.match?(%r{\A/(pacticipants|pacts|verification-results|environments|deployed-versions|released-versions|integrations|dashboard|matrix)(/|\?|\z)}) && !link_path.include?('{')
          queue << link_path unless records.key?(link_path)
        end
      end
      value.each_value { |v| collect_links.call(v) }
    when Array
      value.each { |v| collect_links.call(v) }
    end
  end
  collect_links.call(body) if response.status == 200
end
File.write(ARGV.fetch(0),JSON.pretty_generate({upstream: `git rev-parse HEAD`.strip, description:'Synthetic example applications seeded through upstream TestDataBuilder; all bodies are captured OSS Broker responses.',base_url:'http://broker.example',records:records})+"\n")
puts "Captured #{records.size} responses"

if ENV['PACT_UI_SERVE'] == 'true'
  require 'rackup/handler/webrick'
  Rackup::Handler::WEBrick.run(app, Host: '127.0.0.1', Port: Integer(ENV.fetch('PACT_UI_BROKER_PORT','9293')))
end

# Disposable Rack::Test instrumentation, loaded alongside the existing request tests.
require 'json'
require 'rack/test'
module PactUiResponseCapture
  def process_request(uri, env, &block)
    result = super
    begin
      response = last_response
      record = { example_file: RSpec.current_example&.metadata&.fetch(:file_path, nil), method: env['REQUEST_METHOD'], path: env['PATH_INFO'], query: env['QUERY_STRING'], status: response.status,
        content_type: response.content_type.to_s.split(';').first.to_s, request_type: env['CONTENT_TYPE'].to_s.split(';').first.to_s }
      record[:headers] = response.headers.select { |k, _| %w[location etag last-modified x-pact-broker-version retry-after].include?(k.downcase) }
      record[:body] = JSON.parse(response.body) if record[:content_type].include?('json')
      input = env['rack.input']
      if input&.respond_to?(:rewind)
        input.rewind
        body = input.read
        input.rewind
        record[:request] = JSON.parse(body) if record[:request_type].include?('json') && !body.empty?
      end
      File.open(ENV.fetch('PACT_UI_CAPTURE'), 'a') { |f| f.puts(JSON.generate(record)) }
    rescue JSON::ParserError
      # Intentionally malformed requests/responses are not schema evidence.
    end
    result
  end
end
Rack::Test::Session.prepend(PactUiResponseCapture)
# Upstream marks a subset of examples validate_oas:true but only registers its
# document behind a coverage environment flag. Register without its 100% gate.
require 'openapi_first'
OpenapiFirst::Test.setup { |test| test.register('pact_broker_oas.yaml') }

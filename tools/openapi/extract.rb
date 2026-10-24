# Run in the upstream checkout with bundle exec ruby -Ilib /path/to/extract.rb OUTPUT.
# Executes Broker's own route introspection against a temporary in-memory database.
require 'json'
require 'yaml'
require 'sequel'
require 'pathname'
require 'pact_broker'
require 'pact_broker/db'
PactBroker::DB.connection = Sequel.sqlite
PactBroker::DB.run_migrations(PactBroker::DB.connection)
require 'pact_broker/api'
require 'webmachine/describe_routes'
require 'dry/schema/extensions/json_schema'
Dry::Schema.load_extensions(:json_schema)

def source_for(klass)
  names = klass.instance_methods(false) + klass.private_instance_methods(false)
  (names.filter_map { |name| klass.instance_method(name).source_location&.first } + [klass.name && Object.const_source_location(klass.name)&.first]).compact.uniq
end

def contract_schema(klass, seen = [])
  return nil unless klass.respond_to?(:schema)
  return { 'x-uncertainty' => 'Recursive custom validation contract.' } if seen.include?(klass)
  result = JSON.parse(JSON.generate(klass.schema.json_schema(loose: true)))
  # dry-schema's compiler cannot infer the type of maybe(min_size?: 1).
  # Enrich custom validate_with_contract/validate_each_with_contract from their
  # actual Ruby declarations, rather than treating an exported null as exhaustive.
  source = source_for(klass).map { |p| File.read(p) }.join("\n")
  source.scan(/rule\(:(\w+)\)\.validate\(validate_(each_)?with_contract:\s*(\w+)\)/).each do |field, each, target|
    next unless result.fetch('properties', {}).key?(field)
    child_class = klass.const_defined?(target) ? klass.const_get(target) : PactBroker::Api::Contracts.const_get(target)
    child = contract_schema(child_class, seen + [klass])
    next unless child
    parent = result.fetch('properties', {})[field] || {}
    nullable = Array(parent['type']).include?('null')
    shape = each ? { 'type' => 'array', 'items' => child } : child
    result['properties'][field] = nullable ? { 'anyOf' => [shape, { 'type' => 'null' }] } : shape
  end
  result
rescue StandardError => e
  { 'x-uncertainty' => "#{klass}: #{e.class}: #{e.message}" }
end

require 'pact_broker/diagnostic/app'
diagnostic_app = PactBroker::Diagnostic::App.new.build_diagnostic_app.application
# Diagnostic resources lack policy_name; use the same route DTO without policy introspection.
diagnostic_routes = diagnostic_app.routes.map do |r|
  Webmachine::DescribeRoutes::Route.new(path_spec: r.path_spec, resource_class: r.resource, resource_name: r.instance_variable_get(:@bindings)[:resource_name], schemas: [], resource_class_location: source_for(r.resource).first.delete_prefix(Dir.pwd + '/'))
end
routes = (PactBroker.routes + diagnostic_routes).map do |route|
  sample = route.build_resource({'REQUEST_METHOD' => 'GET'}, PactBroker::ApplicationContext.default_application_context, {})
  methods = sample.allowed_methods.map do |method|
    resource = route.build_resource({'REQUEST_METHOD' => method}, PactBroker::ApplicationContext.default_application_context, {})
    schema = route.schemas.find { |s| s[:http_method] == method }&.fetch(:class)
    media = ->(name) { resource.respond_to?(name) ? resource.send(name).map(&:first) : [] }
    ancestors = route.resource_class.ancestors.take_while { |c| c != Webmachine::Resource }
    source = ancestors.flat_map { |c| source_for(c) }.select { |p| p.start_with?(Dir.pwd) }.map { |p| p.delete_prefix(Dir.pwd + '/') }.uniq
    { method: method, request_schema_class: schema&.name, request_schema: schema && contract_schema(schema),
      schema_input: schema && (%w[GET HEAD].include?(method) ? (schema.name.match?(/Query|Pagination/) ? 'query' : 'unused') : schema.name.end_with?('PutPactParamsContract') ? 'internal' : 'body'),
      injected_fields: source.any? { |p| File.read(p).match?(/params\.merge\(uuid: uuid\)|\{ uuid: uuid \}/) } ? ['uuid'] : [],
      body_required: resource.respond_to?(:request_body_required?, true) && resource.send(:request_body_required?),
      provides: media.call(:content_types_provided), accepts: media.call(:content_types_accepted), sources: source,
      paginated: ancestors.include?(PactBroker::Api::Resources::PaginationMethods),
      query_keys: source.select { |p| p.include?('/resources/') && !p.end_with?('/base_resource.rb') }.flat_map { |p| File.read(p).scan(/(?:request\.query|query_params)\[(?:["'])([^"']+)["']\]/).flatten }.uniq,
      decorators: source.select { |p| p.include?('/resources/') }.flat_map { |p| File.read(p).scan(/decorator_class\(:(\w+)\)/).flatten }.uniq,
      explicit_statuses: source.select { |p| p.include?('/resources/') }.flat_map { |p| File.read(p).scan(/(?:return|response\.status\s*=)\s+(\d{3})/).flatten }.uniq }
  end
  { path: '/' + route.path_spec.map { |p| p.is_a?(Symbol) ? "{#{p}}" : p }.join('/'),
    resource: route.resource_class.name, name: route.resource_name, source: route.resource_class_location,
    registration_index: (PactBroker::API.application.routes + diagnostic_app.routes).index { |r| r.path_spec == route.path_spec && r.resource == route.resource_class },
    methods: methods }
end
# Preserve serializer field names and embedding from actual loaded Roar definitions.
decorators = PactBroker::Api::Decorators.constants.filter_map do |name|
  klass = PactBroker::Api::Decorators.const_get(name)
  next unless klass.is_a?(Class) && klass.respond_to?(:representable_attrs)
  fields = klass.representable_attrs.values.map do |field|
    options = field.instance_variable_get(:@options)
    ext = options[:extend]
    ext = ext.call if ext.is_a?(Proc) && ext.arity == 0
    { name: (options[:as] || options[:name]).to_s, collection: !!options[:collection], embedded: !!options[:embedded],
      decorator: (ext.respond_to?(:name) ? ext.name : nil) }
  end
  [klass.name, { fields: fields, sources: source_for(klass).map { |p| p.delete_prefix(Dir.pwd + '/') } }]
end.to_h
File.write(ARGV.fetch(0), JSON.pretty_generate({ upstream_sha: `git rev-parse HEAD`.strip, routes: routes, decorators: decorators,
  existing_oas: YAML.safe_load_file('pact_broker_oas.yaml') }))

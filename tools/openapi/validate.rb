# Validate every captured JSON response against the generated operation schema.
require 'json'
require 'yaml'
require 'json_schemer'
root = File.expand_path('../..', __dir__)
spec = YAML.safe_load_file(File.join(root,'openapi/pact-broker.yaml'), aliases: true)
inventory=JSON.parse(File.read(File.join(root,'openapi/source-inventory.json')))
order=inventory['routes'].to_h { |r| [r['path'],r['registration_index']] }
patterns = spec['paths'].map do |path, methods|
  [path, Regexp.new('\\A'+Regexp.escape(path).gsub(/\\\{[^}]+\\\}/,'[^/]+')+'/?\\z'), methods]
end.sort_by { |path, _, _| order.fetch(path) }
errors=[]
checked=0
File.foreach(File.join(root,'openapi/observations.jsonl')) do |line|
  observation=JSON.parse(line)
  next unless observation.key?('body')
  next unless observation['example_file']&.match?(%r{/features/|/integration/})
  route=patterns.find { |_, regex, _| regex.match?(observation['path']) }
  operation=route && route[2][observation['method'].downcase]
  next unless operation
  response=operation['responses'][observation['status'].to_s]
  schema=response&.dig('content',observation['content_type'],'schema')
  next unless schema
  validator=JSONSchemer.schema(schema.merge('components'=>spec['components']))
  failures=validator.validate(observation['body']).to_a
  checked+=1
  errors << {path:route[0],method:observation['method'],status:observation['status'],errors:failures.map { |e| {pointer:e['data_pointer'],type:e['type']} }} unless failures.empty?
end
request_checked=0
File.foreach(File.join(root,'openapi/observations.jsonl')) do |line|
  observation=JSON.parse(line)
  next unless observation.key?('request') && observation['status'].between?(200,299)
  next unless observation['example_file']&.match?(%r{/features/|/integration/})
  route=patterns.find { |_,regex,_| regex.match?(observation['path']) }
  operation=route && route[2][observation['method'].downcase]
  schema=operation&.dig('requestBody','content',observation['request_type'],'schema')
  next unless schema
  failures=JSONSchemer.schema(schema.merge('components'=>spec['components'])).validate(observation['request']).to_a
  request_checked+=1
  errors << {path:route[0],method:observation['method'],request:true,errors:failures.map { |e| {pointer:e['data_pointer'],type:e['type']} }} unless failures.empty?
end
report={checked:checked,requests_checked:request_checked,failures:errors}
File.write(File.join(root,'openapi/validation.json'),JSON.pretty_generate(report)+"\n")
puts JSON.generate({checked:checked,requests_checked:request_checked,failed:errors.length})
exit(errors.empty? ? 0 : 1)

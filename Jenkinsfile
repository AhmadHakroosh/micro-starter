library identifier: 'jenkins-shared-libs@master',

    retriever: modernSCM([
      $class: 'GitSCMSource',
      credentialsId: 'jenkins-surfsight',
      remote: 'git@bitbucket.org:surfsight/jenkins-shared-libs.git'
])

CloudEKSService(
  agent_label: "amzn2_docker",
  tests_enabled: true
)